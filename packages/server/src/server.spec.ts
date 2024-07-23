import { FastifyInstance } from 'fastify'

import { NewSubscription, Subscription } from '@/services/subscriptions/types.js'

import '@/testing/network.js'

import { mockServer } from '@/testing/server.js'

const testSubContent = {
  id: 'macatron',
  agent: 'xcm',
  owner: 'unknown',
  args: {
    origin: 'urn:ocn:local:1000',
    senders: ['ALICE'],
    events: '*',
    destinations: ['urn:ocn:local:2000'],
  },
  channels: [
    {
      type: 'log',
    },
  ],
} as Subscription

describe('monitoring server API', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await mockServer({
      cors: true,
    })
    return server.ready()
  })

  afterAll(() => {
    return server.close()
  })

  describe('create resources', () => {
    it('should get the root resource', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/',
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(200)
          expect(response.headers['content-type']).toStrictEqual('text/plain; charset=utf-8')

          done()
        },
      )
    })

    it('should get ingress networks', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/ingress/networks',
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(200)
          expect(response.json().length).toBeGreaterThan(1)

          done()
        },
      )
    })

    it('should throw if instantiating the server with non-local agent catalog', async () => {
      await expect(
        mockServer({
          mode: 'lol',
        }),
      ).rejects.toThrow('Only local agent service is supported')
    })

    it('should return 400 on malformed subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: {
            hello: 9,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(400)
        },
      )
    })

    it('should create a subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: testSubContent,
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(201)
        },
      )
    })

    it('should create a wildcard subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: {
            id: 'wild',
            agent: 'xcm',
            args: {
              origin: 'urn:ocn:local:1000',
              senders: '*',
              events: '*',
              destinations: ['urn:ocn:local:2000'],
            },
            channels: [
              {
                type: 'log',
              },
            ],
          } as NewSubscription,
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(201)
        },
      )
    })

    it('should create a multiple subscriptions', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: [
            {
              ...testSubContent,
              id: 'm1',
            },
            {
              ...testSubContent,
              id: 'm2',
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(201)
        },
      )
    })
  })

  describe('modify resources', () => {
    it('should fail creating a subscription with an existing id', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: testSubContent,
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(400)
        },
      )
    })

    it('should revert if a subscription fails in a batch create', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: [
            {
              ...testSubContent,
              id: 'm3',
            },
            {
              ...testSubContent,
              id: 'm1',
            },
          ],
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(400)

          server.inject(
            {
              method: 'GET',
              url: '/subs/xcm/m3',
            },
            (_, r) => {
              done()
              expect(r.statusCode).toStrictEqual(404)
            },
          )
        },
      )
    })

    it('should delete an existing subscription', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: '/subs/xcm/m2',
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
        },
      )
    })

    it('should retrieve an existing subscription', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/xcm/macatron',
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(JSON.parse(response.body)).toEqual(testSubContent)
        },
      )
    })

    it('should retrieve an existing wildcard subscription', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/xcm/wild',
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(JSON.parse(response.body).args.senders).toEqual('*')
        },
      )
    })

    it('should get a not found for non existent subscriptions', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/xcm/non-existent',
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(404)
        },
      )
    })

    it('should not allow arbitrary operations', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/xcm/macatron',
          body: [
            {
              op: 'replace',
              path: '/id',
              value: 'randid',
            },
            {
              op: 'add',
              path: '/args/senders/-',
              value: 'BOB',
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(400)
        },
      )
    })

    it('should add a new sender', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/xcm/macatron',
          body: [
            {
              op: 'add',
              path: '/args/senders/-',
              value: 'BOB',
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)

          expect(JSON.parse(response.body).args.senders).toEqual(['ALICE', 'BOB'])
        },
      )
    })

    it('should validate the patched object', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/xcm/macatron',
          body: [
            {
              op: 'remove',
              path: '/args/senders',
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
        },
      )
    })

    it('should add a new destination', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/xcm/macatron',
          body: [
            {
              op: 'add',
              path: '/args/destinations/-',
              value: 'urn:ocn:local:3000',
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(JSON.parse(response.body).args.destinations).toEqual([
            'urn:ocn:local:2000',
            'urn:ocn:local:3000',
          ])
        },
      )
    })

    it('should replace the notification method', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/xcm/macatron',
          body: [
            {
              op: 'replace',
              path: '/channels/0',
              value: {
                type: 'webhook',
                url: 'http://localhost:4444/path',
              },
            },
          ],
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(JSON.parse(response.body).channels[0].type).toEqual('webhook')
        },
      )
    })
  })

  describe('query', () => {
    it('should do a query', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/query/steward',
          body: {
            args: {
              op: 'assets.metadata',
              criteria: [
                {
                  network: 'urn:ocn:polkadot:1000',
                  assets: ['1984', '1337'],
                },
              ],
            },
          },
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(200)
          done()
        },
      )
    })
  })

  describe('get resources', () => {
    it('should get agents', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/agents',
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(200)
          expect(response.json()).toEqual(['xcm', 'informant', 'steward'])
          done()
        },
      )
    })

    it('should get agent input schema', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/agents/xcm/inputs',
        },
        (_err, response) => {
          const schema = response.json()
          expect(response.statusCode).toStrictEqual(200)
          expect(schema.type).toBe('object')
          expect(schema.properties.origin).toBeDefined()
          expect(schema.properties.senders).toBeDefined()
          expect(schema.properties.destinations).toBeDefined()
          expect(schema.properties.bridges).toBeDefined()
          expect(schema.properties.events).toBeDefined()
          expect(schema.properties.outboundTTL).toBeDefined()
          done()
        },
      )
    })

    it('should get agent query schema', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/agents/steward/queries',
        },
        (_err, response) => {
          const schema = response.json()
          expect(response.statusCode).toStrictEqual(200)
          expect(schema).toBeDefined()
          done()
        },
      )
    })
  })
})
