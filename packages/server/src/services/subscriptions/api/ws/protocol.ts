import { EventEmitter } from 'node:events'

import { WebSocket } from '@fastify/websocket'
import { safeDestr } from 'destr'
import { FastifyRequest } from 'fastify'
import { ulid } from 'ulidx'
import { ZodError, ZodIssueCode, z } from 'zod'

import { ValidationError, errorMessage } from '@/errors.js'
import { AgentId } from '@/services/agents/types.js'
import { JwtPayload, ensureAccountAuthorized } from '@/services/auth/index.js'
import { Message } from '@/services/egress/types.js'
import { Switchboard } from '@/services/subscriptions/switchboard.js'
import {
  $Subscription,
  EgressMessageListener,
  EgressTerminateListener,
  NewSubscription,
  Subscription,
} from '@/services/subscriptions/types.js'
import { TelemetryEventEmitter, publishTelemetryFrom } from '@/services/telemetry/types.js'
import { Logger } from '@/services/types.js'
import { ensureOwnership } from '../handlers.js'
import { WebsocketProtocolOptions } from './plugin.js'

const $EphemeralSubscription = z
  .string()
  .transform((str, ctx) => {
    try {
      return {
        ...safeDestr<NewSubscription>(str),
        id: ulid(),
        owner: '',
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
 *
 * @see https://github.com/sodazone/ocelloids-services/issues/91
 */
export default class WebsocketProtocol extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #switchboard: Switchboard
  readonly #broadcaster: EgressMessageListener
  readonly #terminator: EgressTerminateListener
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
    this.#terminator = (sub) => {
      const connections = this.#connections.get(sub.id)
      if (connections) {
        for (const connection of connections) {
          const { socket } = connection
          try {
            socket.close(1001)
          } catch (error) {
            socket.terminate()
            this.#log.error(error)
          }
        }
      }
      this.#connections.delete(sub.id)
    }

    this.#switchboard.addEgressListener('websocket', this.#broadcaster)
    this.#switchboard.addEgressListener('terminate', this.#terminator)
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
    },
  ) {
    if (this.#clientsNum >= this.#maxClients) {
      socket.close(1013, 'server too busy')
      return
    }

    const fastify = request.server
    if (fastify.authEnabled) {
      socket.once('message', (data: Buffer) => {
        setImmediate(async () => {
          try {
            const payload = fastify.jwt.verify<JwtPayload>(data.toString().trim())
            await ensureAccountAuthorized(fastify, request, payload)
            await this.#handleSubscribe(socket, request, ids)
            // acknowledge auth
            socket.send(JSON.stringify({ code: 1000, error: false }))
          } catch (error) {
            fastify.log.error(error)
            socket.close(1002, 'auth error')
          }
        })
      })
    } else {
      await this.#handleSubscribe(socket, request, ids)
    }
  }

  async #handleSubscribe(
    socket: WebSocket,
    request: FastifyRequest,
    ids?: {
      subscriptionId: string
      agentId: AgentId
    },
  ) {
    try {
      if (ids === undefined) {
        let resolvedId: { id: string; agent: AgentId } | undefined = undefined

        // on-demand ephemeral subscriptions
        socket.on('message', (data: Buffer) => {
          setImmediate(async () => {
            if (resolvedId) {
              /* c8 ignore next */
              this.#safeWrite(socket, resolvedId)
            } else {
              const parsed = $EphemeralSubscription.safeParse(data.toString())
              if (parsed.success) {
                const onDemandSub = parsed.data
                try {
                  this.#addSubscriber(onDemandSub, socket, request)
                  resolvedId = { id: onDemandSub.id, agent: onDemandSub.agent }
                  await this.#switchboard.subscribe(onDemandSub, request.account?.subject)
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
                      ]),
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
        if (request.server.authEnabled && subscription.public !== true) {
          try {
            ensureOwnership(request, subscription)
          } catch {
            socket.close(1002, 'auth error')
            return
          }
        }
        this.#addSubscriber(subscription, socket, request)
      }
    } catch (_e) {
      socket.close(1007, 'inconsistent payload')
    }
  }

  stop() {
    this.#switchboard.removeEgressListener('websocket', this.#broadcaster)
    this.#switchboard.removeEgressListener('terminate', this.#terminator)
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

      this.emit('telemetrySocketListener', request.ip, subscription, true)

      const { id, agent, ephemeral } = subscription

      try {
        if (ephemeral) {
          // TODO clean up pending matches
          await this.#switchboard.unsubscribe(agent, id)
        }
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
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(content), (error) => {
        if (error) {
          this.#log.error(error, 'error while write')
        }
      })
    } else {
      this.#log.error('websocket is not open')
    }
  }

  #telemetryPublish(ip: string, msg: Message) {
    this.emit('telemetryPublish', publishTelemetryFrom('websocket', ip, msg))
  }

  #telemetryPublishError(ip: string, msg: Message, error: string) {
    this.emit('telemetryPublishError', publishTelemetryFrom('websocket', ip, msg, error))
  }
}
