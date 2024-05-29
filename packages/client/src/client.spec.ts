import { jest } from '@jest/globals'

import { Server, WebSocket } from 'mock-socket'
import nock from 'nock'

import samples from '../test/.data/samples.json'
import type { Subscription, WsAuthErrorEvent } from './lib'
import { XcmSubscriptionInputs } from './xcm/types'

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
      })
    ).toBeDefined()
  })

  describe('ws', () => {
    let mockServer: Server

    afterEach(() => {
      mockServer?.stop()
    })

    it('should connect to a subscription', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockServer = new Server(wsUrl, { mock: false })
      const samplesNum = samples.length

      mockServer.on('connection', (socket) => {
        for (const s of samples) {
          socket.send(JSON.stringify(s))
        }
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      let called = 0
      const ws = client.subscribe(
        {
          subscriptionId: 'subid',
          agentId: 'agentid',
        },
        {
          onMessage: (msg) => {
            expect(ws.readyState).toBe(1)
            expect(msg).toBeDefined()

            switch (called) {
              case 1:
                expect(isXcmSent(msg)).toBeTruthy()
                break
              case 2:
                expect(isXcmReceived(msg)).toBeTruthy()
                break
              default:
              //
            }

            if (++called === samplesNum) {
              done()
            }
          },
        }
      )
    })

    it('should create on-demand subscription', (done) => {
      const wsUrl = 'ws://mock/ws/subs'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          socket.send(JSON.stringify(data))
          socket.send(JSON.stringify(samples[0]))
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      const ws = client.subscribe<XcmSubscriptionInputs>(
        {
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
        },
        {
          onMessage: (msg) => {
            expect(ws.readyState).toBe(1)
            expect(msg).toBeDefined()
            expect(isXcmRelayed(msg)).toBeTruthy()
            done()
          },
        },
        {
          onSubscriptionCreated: (sub) => {
            expect(sub.agent).toBe('xcm')
          },
        }
      )
    })

    it('should handle on-demand subscription creation errors', (done) => {
      const wsUrl = 'ws://mock/ws/subs'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
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
            })
          )
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc',
      })

      const ws = client.subscribe(
        {
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
        },
        {
          onMessage: (_) => {
            fail('should not receive messages')
          },
        },
        {
          onSubscriptionError: (err) => {
            expect(ws.readyState).toBe(1)
            expect(err).toBeDefined()
            expect(isSubscriptionError(err)).toBeTruthy()
            done()
          },
        }
      )
    })

    it('should handle socket closed', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
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

      client.subscribe(
        {
          agentId: 'agentid',
          subscriptionId: 'subid',
        },
        {
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
        }
      )
    })

    it('should authentitcate', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          expect(data).toBe('abracadabra')
          socket.send('{ "code": 1000, "error": false }')
          socket.send(JSON.stringify(samples[0]))
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        wsAuthToken: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.subscribe(
        {
          agentId: 'agentid',
          subscriptionId: 'subid',
        },
        {
          onMessage: (_) => {
            done()
          },
          onError: (_) => {
            fail('should not receive error')
          },
          onClose: (_) => {
            fail('should not receive close')
          },
        }
      )
    })

    it('should handle auth error', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
        socket.on('message', (_) => {
          socket.send('{ "code": 3001, "error": true, "reason": "none" }')
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        wsAuthToken: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.subscribe(
        {
          agentId: 'agentid',
          subscriptionId: 'subid',
        },
        {
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
        }
      )
    })

    it('should throw auth error event', (done) => {
      const wsUrl = 'ws://mock/ws/subs/agentid/subid'
      mockServer = new Server(wsUrl, { mock: false })

      mockServer.on('connection', (socket) => {
        socket.on('message', (_) => {
          socket.send('{ "code": 3001, "error": true, "reason": "none" }')
        })
      })

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        wsAuthToken: 'abracadabra',
        httpUrl: 'https://rpc.abc',
      })

      client.subscribe(
        {
          agentId: 'agentid',
          subscriptionId: 'subid',
        },
        {
          onMessage: (_) => {
            fail('should not receive message')
          },
          onError: (error) => {
            const authError = error as WsAuthErrorEvent
            expect(authError.name).toBe('WsAuthError')
            done()
          },
        }
      )
    })
  })

  describe('http', () => {
    afterAll(() => {
      nock.restore()
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
      } as Subscription

      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/subs')
        .reply(201, JSON.stringify(sub))

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      await client.create(sub)

      scope.done()
    })

    it('should fetch data', async () => {
      const scope = nock('http://mock')
        .get('/health')
        .reply(200, '{}')
        .get('/subs')
        .reply(200, '[]')
        .get('/subs/id')
        .reply(200, '{}')

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
      })

      await client.health()
      await client.allSubscriptions()
      await client.getSubscription('id')

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
        httpAuthToken: 'abracadabra',
      })

      await client.health()

      scope.done()
    })

    it('should handle auth error', async () => {
      const scope = nock('http://mock').get('/health').reply(401)

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock',
        httpAuthToken: 'abracadabra',
      })

      await expect(client.health()).rejects.toStrictEqual({ status: 401, statusText: 'Unauthorized' })

      scope.done()
    })
  })
})
