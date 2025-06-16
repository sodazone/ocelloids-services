import { randomUUID } from 'node:crypto'

import { asJSON } from '@/common/util.js'

import { IncomingMessage } from 'node:http'
import {
  AnyQueryArgs,
  ServerSideEvent,
  ServerSideEventsConnection,
  ServerSideEventsRequest,
} from '../types.js'

const MAX_CONNECTIONS_PER_IP = 5

export function createServerSideEventsBroadcaster<T extends AnyQueryArgs = AnyQueryArgs>(
  matchFilters: (filters: T, event: ServerSideEvent) => boolean = () => true,
) {
  // TODO limits per account
  const connections: Map<string, ServerSideEventsConnection<T>> = new Map()
  let keepAliveInterval: NodeJS.Timeout | undefined
  const ipConnectionCounts: Map<string, number> = new Map()

  const getClientIP = (req: IncomingMessage): string => {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
    )
  }

  const incrementIP = (ip: string): boolean => {
    const count = ipConnectionCounts.get(ip) || 0
    if (count >= MAX_CONNECTIONS_PER_IP) {
      return false
    }
    ipConnectionCounts.set(ip, count + 1)
    return true
  }

  const decrementIP = (ip: string) => {
    const count = ipConnectionCounts.get(ip)
    if (!count) {
      return
    }
    if (count === 1) {
      ipConnectionCounts.delete(ip)
    } else {
      ipConnectionCounts.set(ip, count - 1)
    }
  }

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
    const ip = getClientIP(request)
    if (!incrementIP(ip)) {
      reply.writeHead(429, { 'Content-Type': 'text/plain' })
      reply.end('Too many concurrent SSE connections from this IP.')
      return
    }

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
    request.socket.on('error', () => disconnect(connections.get(id)!))

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

    keepAlive()
  }

  const disconnect = (connection: ServerSideEventsConnection) => {
    const ip = getClientIP(connection.request)
    connection.request.destroy()
    connections.delete(connection.id)
    decrementIP(ip)

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
