import { jest } from '@jest/globals'

import { Server, WebSocket } from 'mock-socket'
import nock from 'nock'

import samples from '../test/.data/samples.json'
import type { QueryResult, Subscription, WsAuthErrorEvent } from './lib'
import { XcmInputs, XcmMessagePayload } from './xcm/types'

jest.unstable_mockModule('isows', () => {
  return {
    __esModule: true,
    WebSocket,
  }
})

//[!] important: requires dynamic imports
const { OcelloidsClient } = await import('./client')
const { isSubscriptionError } = await import('./lib')
const { isXcmReceived, isXcmSent, isXcmRelayed } = await import('./xcm/types')

describe('OcelloidsClient', () => {
  it('should create a client instance', () => {
    expect(
      new OcelloidsClient({
        wsUrl: 'wss://ws.abc',
        httpUrl: 'https://rpc.abc',
      }),
    ).toBeDefined()
  })

  describe('ws', () => {
    let mockWebSocketServer: Server

    beforeEach(() => {
      nock('https://rpc.abc')
        .matchHeader('content-type', 'application/json')
        .matchHeader('authorization', 'Bearer abracadabra')
        .get('/ws/nod')
        .reply(
          200,
          JSON.stringify({
            token: 'ey123',
          }),
        )
    })

    afterEach(() => {
      mockWebSocketServer?.stop()
    })

    it('should connect to a subscription', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockWebSocketServer = new Server(wsUrl, { mock: false })
      const samplesNum = samples.length

      mockWebSocketServer.on('connection', (socket) => {
        for (const s of samples) {
          socket.send(
            JSON.stringify({
              metadata: {},
              payload: s,
            }),
          )
        }
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      let called = 0
      client.agent('agentid').subscribe<XcmMessagePayload>('subid', {
        onMessage: (msg) => {
          expect(msg).toBeDefined()

          switch (called) {
            case 1:
              expect(isXcmSent(msg.payload)).toBeTruthy()
              break
            case 2:
              expect(isXcmReceived(msg.payload)).toBeTruthy()
              break
            default:
            //
          }

          if (++called === samplesNum) {
            done()
          }
        },
      })
    })

    it('should create on-demand subscription', (done) => {
      const wsUrl = 'ws://mock/ws/subs'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          socket.send(data)
          socket.send(JSON.stringify({ payload: samples[0] }))
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      client.agent<XcmInputs>('xcm').subscribe(
        {
          origin: 'urn:ocn:local:2004',
          senders: '*',
          events: '*',
          destinations: [
            'urn:ocn:local:0',
            'urn:ocn:local:1000',
            'urn:ocn:local:2000',
            'urn:ocn:local:2034',
            'urn:ocn:local:2104',
          ],
        },
        {
          onMessage: (msg) => {
            expect(msg).toBeDefined()
            expect(isXcmRelayed(msg.payload)).toBeTruthy()
            done()
          },
        },
        {
          onSubscriptionCreated: (sub) => {
            expect(sub.agent).toBe('xcm')
          },
        },
      )
    })

    it('should create on-demand subscription with auth', (done) => {
      const wsUrl = 'ws://mock/ws/subs'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        let auth = false
        socket.on('message', (data) => {
          if (auth) {
            socket.send(data)
            socket.send(JSON.stringify({ payload: samples[0] }))
          } else {
            expect(data).toBe('abracadabra')
            socket.send('{ "code": 1000, "error": false }')
            auth = true
          }
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
        apiKey: 'abracadabra',
      })

      client.agent<XcmInputs>('xcm').subscribe(
        {
          origin: 'urn:ocn:local:2004',
          senders: '*',
          events: '*',
          destinations: [
            'urn:ocn:local:0',
            'urn:ocn:local:1000',
            'urn:ocn:local:2000',
            'urn:ocn:local:2034',
            'urn:ocn:local:2104',
          ],
        },
        {
          onMessage: (msg) => {
            expect(msg).toBeDefined()
            expect(isXcmRelayed(msg.payload)).toBeTruthy()
            done()
          },
        },
        {
          onSubscriptionCreated: (sub) => {
            expect(sub.agent).toBe('xcm')
          },
        },
      )
    })

    it('should handle on-demand subscription creation errors', (done) => {
      const wsUrl = 'ws://mock/ws/subs'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (_) => {
          socket.send(
            JSON.stringify({
              name: 'ZodError',
              issues: [
                {
                  code: 'invalid_type',
                  expected: 'string',
                  received: 'undefined',
                  path: [''],
                  message: 'origin id is required',
                },
              ],
            }),
          )
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      client.agent<XcmInputs>('xcm').subscribe(
        {
          origin: 'urn:ocn:local:2004',
          senders: '*',
          events: '*',
          destinations: [
            'urn:ocn:local:0',
            'urn:ocn:local:1000',
            'urn:ocn:local:2000',
            'urn:ocn:local:2034',
            'urn:ocn:local:2104',
          ],
        },
        {
          onMessage: (_) => {
            fail('should not receive messages')
          },
        },
        {
          onSubscriptionError: (err) => {
            expect(err).toBeDefined()
            expect(isSubscriptionError(err)).toBeTruthy()
            done()
          },
        },
      )
    })

    it('should handle socket closed', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.close({
          code: 3004,
          reason: 'ouch',
          wasClean: false,
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      client.agent('agentid').subscribe('subid', {
        onMessage: (_) => {
          fail('should not receive messages')
        },
        onError: (_) => {
          fail('should not receive error')
        },
        onClose: (e) => {
          expect(e).toBeDefined()
          done()
        },
      })
    })

    it('should authentitcate for existing subscription', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          expect(data).toBe('abracadabra')
          socket.send('{ "code": 1000, "error": false }')
          socket.send(JSON.stringify({ payload: samples[0] }))
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        apiKey: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.agent('agentid').subscribe('subid', {
        onMessage: (_) => {
          done()
        },
        onError: (_) => {
          fail('should not receive error')
        },
        onClose: (_) => {
          fail('should not receive close')
        },
      })
    })

    it('should handle auth error', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (_) => {
          socket.send('{ "code": 3001, "error": true, "reason": "none" }')
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        apiKey: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.agent('agentid').subscribe('subid', {
        onMessage: (_) => {
          fail('should not receive message')
        },
        onAuthError: (r) => {
          expect(r.error).toBeTruthy()
          done()
        },
        onError: (_) => {
          fail('should not receive error')
        },
        onClose: (_) => {
          fail('should not receive close')
        },
      })
    })

    it('should throw auth error event', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (_) => {
          socket.send('{ "code": 3001, "error": true, "reason": "none" }')
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        apiKey: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.agent('agentid').subscribe('subid', {
        onMessage: (_) => {
          fail('should not receive message')
        },
        onError: (error) => {
          const authError = error as WsAuthErrorEvent
          expect(authError.name).toBe('WsAuthError')
          done()
        },
      })
    })
  })

  describe('http', () => {
    afterAll(() => {
      nock.restore()
    })

    it('should execute a query', async () => {
      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/query/steward', {
          args: {
            criteria: 'hello',
          },
        })
        .reply(
          200,
          JSON.stringify({
            items: [
              {
                a: 1,
              },
            ],
          } as QueryResult),
        )

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      const res = await client.agent('steward').query<
        {
          criteria: string
        },
        {
          a: number
        }
      >({
        criteria: 'hello',
      })

      expect(res.items[0].a).toBe(1)

      scope.done()
    })

    it('should execute a query with pagination', async () => {
      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/query/steward', {
          pagination: {
            limit: 100,
            cursor: 'b',
          },
          args: {
            criteria: 'hello',
          },
        })
        .reply(
          200,
          JSON.stringify({
            pageInfo: {
              endCursor: 'a',
              hasNextPage: false,
            },
            items: [
              {
                a: 1,
              },
            ],
          } as QueryResult),
        )

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      const res = await client.agent('steward').query<
        {
          criteria: string
        },
        {
          a: number
        }
      >(
        {
          criteria: 'hello',
        },
        {
          cursor: 'b',
          limit: 100,
        },
      )

      expect(res.items[0].a).toBe(1)

      scope.done()
    })

    it('should create a subscription', async () => {
      const sub = {
        id: 'my-subscription',
        agent: 'xcm',
        args: {
          origin: 'urn:ocn:local:2004',
          senders: '*',
          events: '*',
          destinations: [
            'urn:ocn:local:0',
            'urn:ocn:local:1000',
            'urn:ocn:local:2000',
            'urn:ocn:local:2034',
            'urn:ocn:local:2104',
          ],
        },
        channels: [
          {
            type: 'webhook',
            url: 'https://some.webhook',
          },
          {
            type: 'websocket',
          },
        ],
      } as Subscription<XcmInputs>

      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/subs')
        .reply(201, JSON.stringify(sub))

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      await client.agent<XcmInputs>('xcm').create(sub)

      scope.done()
    })

    it('should fetch data', async () => {
      const scope = nock('http://mock')
        .get('/health')
        .reply(200, '{}')
        .get('/subs/xcm')
        .reply(200, '[]')
        .get('/subs/xcm/id')
        .reply(200, '{}')

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      await client.health()

      const xcm = client.agent('xcm')
      await xcm.allSubscriptions()
      await xcm.getSubscription('id')

      scope.done()
    })

    it('should use bearer auth', async () => {
      const scope = nock('http://mock')
        .matchHeader('Authorization', 'Bearer abracadabra')
        .get('/health')
        .reply(200, '{}')

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
        apiKey: 'abracadabra',
      })

      await client.health()

      scope.done()
    })

    it('should handle auth error', async () => {
      const scope = nock('http://mock').get('/health').reply(401)

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
        apiKey: 'abracadabra',
      })

      await expect(client.health()).rejects.toStrictEqual({ status: 401, statusText: 'Unauthorized' })

      scope.done()
    })
  })
})
