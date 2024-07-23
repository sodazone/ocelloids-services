import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { publicToken, rootToken } from '@/testing/data.js'
import { mockServer } from '@/testing/server.js'
import { Subscription } from '../types.js'

const flushPromises = () => new Promise((res) => process.nextTick(res))

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

describe('subscription api', () => {
  let server: FastifyInstance
  let macarioToken = ''
  let pepeToken = ''

  beforeAll(async () => {
    server = await mockServer({
      jwtAuth: true,
      jwtSigKeyFile: 'keys',
    })
    await server.ready()
    // create macario account
    server.inject(
      {
        method: 'GET',
        url: '/accounts/invite?subject=macario@cheetos.io',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        macarioToken = response.json().token
      },
    )
    // create pepe account
    server.inject(
      {
        method: 'GET',
        url: '/accounts/invite?subject=pepe@frog.com',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        pepeToken = response.json().token
      },
    )

    await flushPromises()
  })

  afterAll(() => {
    return server.close()
  })

  describe('public subscriptions', () => {
    it('should create a public subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: { ...testSubContent, public: true },
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(201)
        },
      )
    })

    it('should retrieve a public subscription using public token', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/xcm/macatron',
          headers: {
            authorization: `Bearer ${publicToken}`,
          },
        },
        (_err, response) => {
          const sub = response.json()
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(sub).toBeDefined()
          expect(sub.id).toEqual(testSubContent.id)
          expect(sub.args).toEqual(testSubContent.args)
        },
      )
    })

    it('should retrieve a public subscription using any token with read access', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/xcm/macatron',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          const sub = response.json()
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(sub).toBeDefined()
          expect(sub.id).toEqual(testSubContent.id)
          expect(sub.args).toEqual(testSubContent.args)
        },
      )
    })
  })

  describe('private subscriptions', () => {
    const privSubId = 'macario-sub'

    it('should create a private subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: { ...testSubContent, id: privSubId },
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          console.log(response)
          done()
          expect(response.statusCode).toStrictEqual(201)
        },
      )
    })

    it('should retrieve a private subscription using the owner token', (done) => {
      server.inject(
        {
          method: 'GET',
          url: `/subs/xcm/${privSubId}`,
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          const sub = response.json()
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(sub).toBeDefined()
          expect(sub.id).toEqual(privSubId)
          expect(sub.args).toEqual(testSubContent.args)
        },
      )
    })

    it('should return 401 when trying to retrieve a private subscription with a token of another account', (done) => {
      server.inject(
        {
          method: 'GET',
          url: `/subs/xcm/${privSubId}`,
          headers: {
            authorization: `Bearer ${pepeToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(401)
        },
      )
    })
  })
})
