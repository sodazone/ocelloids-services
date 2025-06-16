import { randomUUID } from 'node:crypto'

import { asJSON } from '@/common/util.js'

import {
  AnyQueryArgs,
  ServerSideEvent,
  ServerSideEventsConnection,
  ServerSideEventsRequest,
} from '../types.js'

export function createServerSideEventsBroadcaster<T extends AnyQueryArgs = AnyQueryArgs>(
  matchFilters: (filters: T, event: ServerSideEvent) => boolean = () => true,
) {
  // TODO limits per account
  const connections: Map<string, ServerSideEventsConnection<T>> = new Map()
  let keepAliveInterval: NodeJS.Timeout | undefined

  const keepAlive = () => {
    if (keepAliveInterval !== undefined) {
      return
    }
    keepAliveInterval = setInterval(() => {
      for (const connection of connections.values()) {
        try {
          connection.send({ event: 'ping', data: { timestamp: Date.now() } })
        } catch {
          connection.request.destroy()
          connections.delete(connection.id)
        }
      }
    }, 30_000).unref()
  }

  const startStreaming = ({ filters, request, reply }: ServerSideEventsRequest<T>) => {
    reply.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const id = randomUUID()
    const send = ({ event, data }: ServerSideEvent) => {
      reply.write(`event: ${event}\ndata: ${asJSON(data)}\n\n`)
    }
    send({ event: 'ping', data: { timestamp: Date.now() } })

    request.on('close', () => {
      const connection = connections.get(id)
      if (connection) {
        disconnect(connection)
      }
    })

    const normalizedFilters = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => {
        if (typeof value === 'string' && value.includes(',')) {
          return [key, value.split(',').map((v) => v.trim())]
        }
        return [key, value]
      }),
    ) as T

    connections.set(id, {
      id,
      filters: normalizedFilters,
      request,
      send,
    })
    if (keepAliveInterval === undefined) {
      keepAlive()
    }
  }

  const disconnect = (connection: ServerSideEventsConnection) => {
    connection.request.destroy()
    connections.delete(connection.id)
    if (connections.size === 0 && keepAliveInterval) {
      clearInterval(keepAliveInterval)
      keepAliveInterval = undefined
    }
  }

  const send = (event: ServerSideEvent) => {
    for (const connection of connections.values()) {
      try {
        if (matchFilters(connection.filters, event)) {
          connection.send(event)
        }
      } catch (error) {
        console.error(error, 'Error sending SSE')
        disconnect(connection)
      }
    }
  }

  const close = () => {
    for (const connection of connections.values()) {
      disconnect(connection)
    }
  }

  return {
    stream: startStreaming,
    close,
    send,
  }
}
