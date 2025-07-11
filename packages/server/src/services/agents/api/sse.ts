import { randomUUID } from 'node:crypto'

import { asJSON } from '@/common/util.js'

import {
  AnyQueryArgs,
  ServerSideEvent,
  ServerSideEventsConnection,
  ServerSideEventsRequest,
} from '../types.js'

function sanitizeFilters<T extends Record<string, any>>(filters: Record<string, unknown>): T {
  const safeFilters: Record<string, unknown> = {}

  for (const [key, rawValue] of Object.entries(filters)) {
    if (!Object.prototype.hasOwnProperty.call(filters, key)) {
      continue
    }

    // Disallow dangerous keys like __proto__, constructor, prototype
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue
    }

    if (typeof rawValue === 'string') {
      // Treat comma-separated strings as arrays
      if (rawValue.includes(',')) {
        safeFilters[key] = rawValue
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      } else {
        safeFilters[key] = rawValue.trim()
      }
    } else if (Array.isArray(rawValue)) {
      // Clean up arrays
      safeFilters[key] = rawValue
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => typeof v === 'string' || typeof v === 'number')
    } else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      safeFilters[key] = rawValue
    } else {
      // For any other type, ignore or handle as needed (could also throw)
      continue
    }
  }

  return safeFilters as T
}

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
    // set existing headers in reply
    Object.entries(reply.getHeaders()).forEach(([key, value]) => {
      if (value) {
        reply.raw.setHeader(key, value)
      }
    })
    reply.raw.setHeaders(
      new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      }),
    )
    reply.raw.writeHead(200)

    const id = randomUUID()
    const send = ({ event, data }: ServerSideEvent) => {
      reply.raw.write(`event: ${event}\ndata: ${asJSON(data)}\n\n`)
    }
    send({ event: 'ping', data: { timestamp: Date.now() } })

    request.on('close', () => {
      const connection = connections.get(id)
      if (connection) {
        disconnect(connection)
      }
    })
    request.socket.on('error', () => disconnect(connections.get(id)!))

    const normalizedFilters = sanitizeFilters(filters) as T

    connections.set(id, {
      id,
      filters: normalizedFilters,
      request,
      send,
    })

    keepAlive()
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
