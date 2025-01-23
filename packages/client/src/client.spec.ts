import { vi } from 'vitest'

import { Server, WebSocket } from 'mock-socket'
import nock from 'nock'

import samples from '../test/.data/samples.json'
import { type QueryResult } from './lib'
import { AssetMetadata, StewardQueryArgs } from './steward/types'
import { isXcmHop, XcmInputs, XcmMessagePayload, XcmSent } from './xcm/types'

vi.mock('isows', () => {
  return {
    __esModule: true,
    WebSocket,
  }
})

import { createXcmAgent } from './agent'
import { OcelloidsClient } from './client'
import { Subscription, WsAuthErrorEvent, isSubscriptionError } from './types'
import { isXcmReceived, isXcmRelayed, isXcmSent } from './xcm/types'

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

    it('should connect to a subscription', async () => {
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

      await new Promise<void>((resolve) => {
        let called = 0
        client.agent('agentid').subscribe<XcmMessagePayload>('subid', {
          onMessage: (msg) => {
            expect(msg).toBeDefined()

            switch (called) {
              case 1:
                expect(isXcmSent(msg)).toBeTruthy()
                expect(isXcmHop(msg)).toBeFalsy()
                break
              case 2:
                expect(isXcmReceived(msg)).toBeTruthy()
                expect(isXcmHop(msg)).toBeFalsy()
                break
              default:
              //
            }

            if (++called === samplesNum) {
              resolve()
            }
          },
        })
      })
    })

    it('should create on-demand subscription', async () => {
      const wsUrl = 'ws://mock/ws/subs'
      mockWebSocketServer = new Server(wsUrl, { mock: false })

      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          socket.send(data)
          socket.send(JSON.stringify({ payload: samples[0] }))
        })
      })

      const agent = createXcmAgent({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })
      await new Promise<void>((resolve) => {
        agent.subscribe(
          {
            origins: ['urn:ocn:local:2004'],
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
              expect(msg.payload.destination).toBeDefined()
              expect(isXcmRelayed(msg)).toBeTruthy()
              resolve()
            },
          },
          {
            onSubscriptionCreated: (sub) => {
              expect(sub.agent).toBe('xcm')
            },
          },
        )
      })
    })

    it('should create on-demand subscription with auth', async () => {
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

      await new Promise<void>((resolve) => {
        client.agent<XcmInputs>('xcm').subscribe<XcmMessagePayload>(
          {
            origins: ['urn:ocn:local:2004'],
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
              expect(isXcmRelayed(msg)).toBeTruthy()
              resolve()
            },
          },
          {
            onSubscriptionCreated: (sub) => {
              expect(sub.agent).toBe('xcm')
            },
          },
        )
      })
    })

    it('should handle on-demand subscription creation errors', async () => {
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

      await new Promise<void>((resolve, reject) => {
        client.agent<XcmInputs>('xcm').subscribe(
          {
            origins: ['urn:ocn:local:2004'],
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
              reject('should not receive messages')
            },
          },
          {
            onSubscriptionError: (err) => {
              expect(err).toBeDefined()
              expect(isSubscriptionError(err)).toBeTruthy()
              resolve()
            },
          },
        )
      })
    })

    it('should handle socket closed', async () => {
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

      await new Promise<void>((resolve, reject) => {
        client.agent('agentid').subscribe('subid', {
          onMessage: (_) => {
            reject('should not receive messages')
          },
          onError: (_) => {
            reject('should not receive error')
          },
          onClose: (e) => {
            expect(e).toBeDefined()
            resolve()
          },
        })
      })
    })

    it('should authentitcate for existing subscription', async () => {
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
      await new Promise<void>((resolve, reject) => {
        client.agent('agentid').subscribe('subid', {
          onMessage: (_) => {
            resolve()
          },
          onError: (_) => {
            reject('should not receive error')
          },
          onClose: (_) => {
            reject('should not receive close')
          },
        })
      })
    })

    it('should handle auth error', async () => {
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

      await new Promise<void>((resolve, reject) => {
        client.agent('agentid').subscribe('subid', {
          onMessage: (_) => {
            reject('should not receive message')
          },
          onAuthError: (r) => {
            expect(r.error).toBeTruthy()
            resolve()
          },
          onError: (_) => {
            reject('should not receive error')
          },
          onClose: (_) => {
            reject('should not receive close')
          },
        })
      })
    })

    it('should throw auth error event', async () => {
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
      await new Promise<void>((resolve, reject) => {
        client.agent('agentid').subscribe('subid', {
          onMessage: (_) => {
            reject('should not receive message')
          },
          onError: (error) => {
            const authError = error as WsAuthErrorEvent
            expect(authError.name).toBe('WsAuthError')
            resolve()
          },
        })
      })
    })
  })

  describe('http', () => {
    afterAll(() => {
      nock.restore()
    })

    it('should execute a query', async () => {
      const queryArgs: StewardQueryArgs = {
        op: 'assets',
        criteria: [{ network: 'urn:ocn:local:0', assets: ['0'] }],
      }
      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/query/steward', {
          args: queryArgs,
        })
        .reply(
          200,
          JSON.stringify({
            items: [
              {
                id: '0',
              },
            ],
          } as QueryResult),
        )

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      const agent = client.agent('steward')
      const res = await agent.query<StewardQueryArgs, AssetMetadata>(queryArgs)

      expect(res.items[0].id).toBe('0')

      scope.done()
    })

    it('should execute a query with pagination', async () => {
      const queryArgs: StewardQueryArgs = {
        op: 'assets',
        criteria: [{ network: 'urn:ocn:local:0', assets: ['0'] }],
      }
      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/query/steward', {
          pagination: {
            limit: 100,
            cursor: 'b',
          },
          args: queryArgs,
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
                id: '0',
              },
            ],
          } as QueryResult),
        )

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      const res = await client.agent('steward').query<StewardQueryArgs, AssetMetadata>(queryArgs, {
        cursor: 'b',
        limit: 100,
      })

      expect(res.items[0].id).toBe('0')

      scope.done()
    })

    it('should create a subscription', async () => {
      const sub = {
        id: 'my-subscription',
        agent: 'xcm',
        args: {
          origins: ['urn:ocn:local:2004'],
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

      await client.agent<XcmInputs>('xcm').createSubscription(sub)

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

    it('should delete a subscription', async () => {
      const scope = nock('http://mock').delete('/subs/xcm/id').reply(200, '{}')

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      const xcm = client.agent('xcm')
      await xcm.deleteSubscription('id')

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

    it('should throw on auth error', async () => {
      const scope = nock('http://mock').get('/health').reply(401)

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
        apiKey: 'abracadabra',
      })

      await expect(client.health()).rejects.toThrow()

      scope.done()
    })

    it('should retry on 429', async () => {
      const retry = vitest.fn(async () => {
        /**/
      })
      const hooks = {
        beforeRetry: [retry],
      }

      const scope = nock('http://mock')
        .get('/health')
        .reply(429, undefined, {
          'Retry-After': '0',
        })
        .get('/health')
        .reply(429, undefined, {
          'Retry-After': '0',
        })
        .get('/health')
        .reply(200, '{}')

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      expect(
        await client.health({
          hooks,
        }),
      ).toStrictEqual({})
      expect(retry).toBeCalledTimes(2)

      scope.done()
    })
  })
})
