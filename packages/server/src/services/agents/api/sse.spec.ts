import { EventEmitter } from 'events'
import { FastifyReply } from 'fastify'
import { Mock } from 'vitest'
import { createServerSentEventsBroadcaster } from './sse.js'

describe('createServerSentEventsBroadcaster', () => {
  let broadcaster: ReturnType<typeof createServerSentEventsBroadcaster>
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
      getHeaders: () => [],
      raw: {
        setHeaders: vi.fn(),
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      },
    }) as unknown as FastifyReply

  beforeEach(() => {
    matchFilters = vi.fn()
    broadcaster = createServerSentEventsBroadcaster(matchFilters)
    reply = createMockReply()
    request = createMockRequest()
  })

  it('should accept a new SSE connection and send initial ping', () => {
    broadcaster.stream({ streamName: 'default', filters: {}, request, reply })
    expect(reply.raw.writeHead).toHaveBeenCalledWith(200)
    expect(reply.raw.write).toHaveBeenCalledWith(expect.stringContaining('event: ping'))
  })

  it('should normalize comma-separated filters to arrays', () => {
    broadcaster.stream({
      streamName: 'default',
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
    const customBroadcaster = createServerSentEventsBroadcaster(matchFilters)
    const customReply = createMockReply()
    const customRequest = createMockRequest()

    customBroadcaster.stream({
      streamName: 'default',
      filters: { foo: 'bar' },
      request: customRequest,
      reply: customReply,
    })

    customBroadcaster.send({ event: 'test', data: { foo: 'bar' } })
    expect(customReply.raw.write).toHaveBeenCalledWith(expect.stringContaining('event: test'))
  })

  it('should disconnect and cleanup on request close', () => {
    broadcaster.stream({ streamName: 'default', filters: {}, request, reply })
    const destroySpy = request.destroy as Mock

    request.emit('close')

    expect(destroySpy).toHaveBeenCalled()
  })

  it('should not send event to non-matching filters', () => {
    const matchFilters = (filters: any, event: any) => filters.foo === event.data.foo
    const customBroadcaster = createServerSentEventsBroadcaster(matchFilters)
    const customReply = createMockReply()
    const customRequest = createMockRequest()

    customBroadcaster.stream({
      streamName: 'default',
      filters: { foo: 'bar' },
      request: customRequest,
      reply: customReply,
    })

    customBroadcaster.send({ event: 'test', data: { foo: 'not-bar' } })

    expect(customReply.raw.write).not.toHaveBeenCalledWith(expect.stringContaining('event: test'))
  })

  it('should send heartbeat ping every 30 seconds', () => {
    vi.useFakeTimers()

    broadcaster.stream({ streamName: 'default', filters: {}, request, reply })

    // Initially, only one ping is sent
    expect(reply.raw.write).toHaveBeenCalledTimes(1)
    expect(reply.raw.write).toHaveBeenCalledWith(expect.stringContaining('event: ping'))

    // Advance time by 30 seconds
    vi.advanceTimersByTime(30_000)

    // Should have sent another ping
    expect(reply.raw.write).toHaveBeenCalledTimes(2)
    expect(reply.raw.write.mock.calls[1][0]).toContain('event: ping')

    // Advance another 30s
    vi.advanceTimersByTime(30_000)
    expect(reply.raw.write).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })
})
