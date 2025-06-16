import { EventEmitter } from 'events'
import { ServerResponse } from 'http'
import { Mock } from 'vitest'
import { createServerSideEventsBroadcaster } from './sse.js'

describe('createServerSideEventsBroadcaster', () => {
  let broadcaster: ReturnType<typeof createServerSideEventsBroadcaster>
  let matchFilters: Mock
  let reply: any
  let request: any

  const createMockRequest = (ip = '127.0.0.1') => {
    const req = new EventEmitter() as any
    req.headers = {}
    req.socket = new EventEmitter()
    req.socket.remoteAddress = ip
    req.on = req.on.bind(req)
    req.destroy = vi.fn()
    return req
  }

  const createMockReply = () =>
    ({
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    }) as unknown as ServerResponse

  beforeEach(() => {
    matchFilters = vi.fn()
    broadcaster = createServerSideEventsBroadcaster(matchFilters)
    reply = createMockReply()
    request = createMockRequest()
  })

  it('should accept a new SSE connection and send initial ping', () => {
    broadcaster.stream({ filters: {}, request, reply })
    expect(reply.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }),
    )
    expect(reply.write).toHaveBeenCalledWith(expect.stringContaining('event: ping'))
  })

  it('should reject connection if max per IP is reached', () => {
    const ip = '1.2.3.4'

    for (let i = 0; i < 5; i++) {
      broadcaster.stream({
        filters: {},
        request: createMockRequest(ip),
        reply: createMockReply(),
      })
    }

    const rejectReply = createMockReply()
    broadcaster.stream({
      filters: {},
      request: createMockRequest(ip),
      reply: rejectReply,
    })

    expect(rejectReply.writeHead).toHaveBeenCalledWith(429, { 'Content-Type': 'text/plain' })
    expect(rejectReply.end).toHaveBeenCalledWith('Too many concurrent SSE connections from this IP.')
  })

  it('should normalize comma-separated filters to arrays', () => {
    broadcaster.stream({
      filters: { origins: 'a,b,c', foo: 'bar' },
      request,
      reply,
    })

    broadcaster.send({
      event: 'test',
      data: {
        origins: 'b',
      },
    })

    expect(matchFilters).toBeCalled()
    expect(matchFilters).toHaveBeenCalledWith(
      { origins: ['a', 'b', 'c'], foo: 'bar' },
      {
        event: 'test',
        data: {
          origins: 'b',
        },
      },
    )
  })

  it('should send events to matching connections', () => {
    const matchFilters = (filters: any, event: any) => filters.foo === event.data.foo
    const customBroadcaster = createServerSideEventsBroadcaster(matchFilters)
    const customReply = createMockReply()
    const customRequest = createMockRequest()

    customBroadcaster.stream({
      filters: { foo: 'bar' },
      request: customRequest,
      reply: customReply,
    })

    customBroadcaster.send({ event: 'test', data: { foo: 'bar' } })
    expect(customReply.write).toHaveBeenCalledWith(expect.stringContaining('event: test'))
  })

  it('should disconnect and cleanup on request close', () => {
    broadcaster.stream({ filters: {}, request, reply })
    const destroySpy = request.destroy as Mock

    request.emit('close')

    expect(destroySpy).toHaveBeenCalled()
  })

  it('should not send event to non-matching filters', () => {
    const matchFilters = (filters: any, event: any) => filters.foo === event.data.foo
    const customBroadcaster = createServerSideEventsBroadcaster(matchFilters)
    const customReply = createMockReply()
    const customRequest = createMockRequest()

    customBroadcaster.stream({
      filters: { foo: 'bar' },
      request: customRequest,
      reply: customReply,
    })

    customBroadcaster.send({ event: 'test', data: { foo: 'not-bar' } })

    expect(customReply.write).not.toHaveBeenCalledWith(expect.stringContaining('event: test'))
  })

  it('should send heartbeat ping every 30 seconds', () => {
    vi.useFakeTimers()

    broadcaster.stream({ filters: {}, request, reply })

    // Initially, only one ping is sent
    expect(reply.write).toHaveBeenCalledTimes(1)
    expect(reply.write).toHaveBeenCalledWith(expect.stringContaining('event: ping'))

    // Advance time by 30 seconds
    vi.advanceTimersByTime(30_000)

    // Should have sent another ping
    expect(reply.write).toHaveBeenCalledTimes(2)
    expect(reply.write.mock.calls[1][0]).toContain('event: ping')

    // Advance another 30s
    vi.advanceTimersByTime(30_000)
    expect(reply.write).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  it('should allow max connections per IP independently', () => {
    // 5 connections for IP1
    for (let i = 0; i < 5; i++) {
      broadcaster.stream({ filters: {}, request: createMockRequest('10.0.0.1'), reply })
    }

    // Should allow 5 connections for IP2
    for (let i = 0; i < 5; i++) {
      broadcaster.stream({ filters: {}, request: createMockRequest('10.0.0.2'), reply })
    }

    expect(reply.writeHead).toHaveBeenCalledTimes(10)
  })
})
