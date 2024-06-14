import { EventEmitter } from 'node:events'

import { WebSocket } from '@fastify/websocket'
import { FastifyRequest } from 'fastify'
import { ulid } from 'ulidx'
import { ZodError, ZodIssueCode, z } from 'zod'

import { ValidationError, errorMessage } from '../../../../errors.js'
import { AgentId } from '../../../agents/types.js'
import { Message } from '../../../egress/types.js'
import { TelemetryEventEmitter, publishTelemetryFrom } from '../../../telemetry/types.js'
import { Logger } from '../../../types.js'
import { Switchboard } from '../../switchboard.js'
import { $Subscription, EgressListener, Subscription } from '../../types.js'
import { WebsocketProtocolOptions } from './plugin.js'

const $EphemeralSubscription = z
  .string()
  .transform((str, ctx) => {
    try {
      return {
        ...JSON.parse(str),
        id: ulid(),
        ephemeral: true,
        channels: [
          {
            type: 'websocket',
          },
        ],
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid JSON' })
      return z.NEVER
    }
  })
  .pipe($Subscription)

type Connection = {
  id: string
  ip: string
  socket: WebSocket
}

/**
 * Websockets subscription protocol.
 */
export default class WebsocketProtocol extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #switchboard: Switchboard
  readonly #broadcaster: EgressListener
  readonly #maxClients: number

  #connections: Map<string, Connection[]>
  #clientsNum: number

  constructor(log: Logger, switchboard: Switchboard, options: WebsocketProtocolOptions) {
    super()

    this.#log = log
    this.#switchboard = switchboard

    this.#connections = new Map()
    this.#maxClients = options.wsMaxClients ?? 10_000
    this.#clientsNum = 0
    this.#broadcaster = (sub, msg) => {
      const connections = this.#connections.get(sub.id)
      if (connections) {
        for (const connection of connections) {
          const { socket, ip } = connection
          try {
            this.#safeWrite(socket, msg)

            this.#telemetryPublish(ip, msg)
          } catch (error) {
            this.#log.error(error)

            this.#telemetryPublishError(ip, msg, errorMessage(error))
          }
        }
      }
    }

    this.#switchboard.addEgressListener('websocket', this.#broadcaster)
  }

  /**
   * Handles incoming connections.
   *
   * If no subscription is given creates an ephemeral through the websocket.
   *
   * @param socket - The websocket
   * @param request - The Fastify request
   * @param ids - The subscription and agent IDs
   */
  async handle(
    socket: WebSocket,
    request: FastifyRequest,
    ids?: {
      subscriptionId: string
      agentId: AgentId
    }
  ) {
    if (this.#clientsNum >= this.#maxClients) {
      socket.close(1013, 'server too busy')
      return
    }

    try {
      if (ids === undefined) {
        let resolvedId: { id: string; agent: AgentId } | undefined = undefined

        // on-demand ephemeral subscriptions
        socket.on('message', (data: Buffer) => {
          setImmediate(async () => {
            if (resolvedId) {
              this.#safeWrite(socket, resolvedId)
            } else {
              const parsed = $EphemeralSubscription.safeParse(data.toString())
              if (parsed.success) {
                const onDemandSub = parsed.data
                try {
                  this.#addSubscriber(onDemandSub, socket, request)
                  resolvedId = { id: onDemandSub.id, agent: onDemandSub.agent }
                  await this.#switchboard.subscribe(onDemandSub)
                  this.#safeWrite(socket, onDemandSub)
                } catch (error) {
                  if (error instanceof ZodError) {
                    this.#safeWrite(socket, error)
                  } else if (error instanceof ValidationError) {
                    this.#safeWrite(
                      socket,
                      new ZodError([
                        {
                          code: ZodIssueCode.custom,
                          path: ['filter', 'match'],
                          message: error.message,
                        },
                      ])
                    )
                  } else {
                    socket.close(1011, 'server error')
                    this.#log.error(error)
                  }
                }
              } else {
                this.#safeWrite(socket, parsed.error)
              }
            }
          })
        })
      } else {
        // existing subscriptions
        const { agentId, subscriptionId } = ids
        const subscription = await this.#switchboard.findSubscription(agentId, subscriptionId)
        this.#addSubscriber(subscription, socket, request)
      }
    } catch {
      socket.close(1007, 'inconsistent payload')
    }
  }

  stop() {
    this.#switchboard.removeEgressListener('websocket', this.#broadcaster)
  }

  #addSubscriber(subscription: Subscription, socket: WebSocket, request: FastifyRequest) {
    if (subscription.channels.findIndex((chan) => chan.type === 'websocket') === -1) {
      throw new Error('websocket channel not enabled in subscription')
    }

    this.#clientsNum++

    const subId = subscription.id
    const connection = {
      id: request.id,
      ip: request.ip,
      socket,
    }

    if (this.#connections.has(subId)) {
      this.#connections.get(subId)?.push(connection)
    } else {
      this.#connections.set(subId, [connection])
    }

    this.emit('telemetrySocketListener', request.ip, subscription)

    socket.once('close', async () => {
      this.#clientsNum--

      const { id, agent, ephemeral } = subscription

      try {
        if (ephemeral) {
          // TODO clean up pending matches
          await this.#switchboard.unsubscribe(agent, id)
        }

        this.emit('telemetrySocketListener', request.ip, subscription, true)
      } catch (error) {
        this.#log.error(error)
      } finally {
        // TODO: check if frees memory
        const connections = this.#connections.get(id)
        if (connections) {
          const index = connections.findIndex((c) => c.id === request.id)
          if (index > -1) {
            connections.splice(index, 1)
          }
          if (connections.length === 0) {
            this.#connections.delete(id)
          }
        }
      }
    })
  }

  #safeWrite(socket: WebSocket, content: NonNullable<unknown>) {
    return socket.send(JSON.stringify(content), (error) => {
      if (error) {
        this.#log.error(error, 'error while write')
      }
    })
  }

  #telemetryPublish(ip: string, msg: Message) {
    this.emit('telemetryPublish', publishTelemetryFrom('websocket', ip, msg))
  }

  #telemetryPublishError(ip: string, msg: Message, error: string) {
    this.emit('telemetryPublishError', publishTelemetryFrom('websocket', ip, msg, error))
  }
}
