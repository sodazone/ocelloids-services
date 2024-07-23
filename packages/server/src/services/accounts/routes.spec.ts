import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { mockServer } from '@/testing/server.js'

const flushPromises = () => new Promise((res) => process.nextTick(res))

describe('accounts api', () => {
  let server: FastifyInstance
  const rootToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6InJvb3RAb2NlbGxvaWRzIiwiaXNzIjoidGVzdCIsImlhdCI6MTcyMTczMzkxN30.nBuCOzUYl4ABOBg8A52ga9R5DUYtx8XdkU_xHlGzy_DMnIhA9qRDZFSzCund3qxQo_Jcv_iB9JZL-7M-5TD7Aw'
  const publicToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6InB1YmxpY0BvY2VsbG9pZHMiLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.eD5EBUclmJp6oyLS_FECuZxUDr_QUp5ISqzTu4H6LiOq_fjLZFJoWdfRZLpGnp5AgOI7rO7LpeiV60wMePW9Aw'
  const invalidToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6Im1hY2FyaW8iLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.TR6eH5XPxSG-fboGrMjlUAzeUL3zyUifu56DK2_bssU8nUKXXacUhvCeLW6zdsuTFAq6gm5rRL9pvbp0n8I2Bg'
  let macarioToken = ''

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

    await flushPromises()
  })

  afterAll(() => {
    return server.close()
  })

  describe('GET /accounts/invite', () => {
    it('should create a token on invite', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/accounts/invite?subject=pepe@frog.com',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(response.json().token).toBeDefined()
        },
      )
    })

    it('should return 401 on invalid token', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/accounts/invite?subject=macario',
          headers: {
            authorization: `Bearer ${invalidToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(401)
        },
      )
    })

    it('should return 401 on a valid non-root token', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/accounts/invite?subject=macario',
          headers: {
            authorization: `Bearer ${publicToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(401)
        },
      )
    })
  })

  describe('/myself/tokens', () => {
    it('should return tokens for macario account', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/myself/tokens',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          const tokens = response.json()
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(tokens).toBeDefined()
          expect(tokens.length).toBe(1)
        },
      )
    })

    it('should create new token for macario account', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/myself/tokens',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
          body: {
            scope: { read: true, write: true },
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(response.json().token).toBeDefined()
        },
      )
    })

    it('should return 400 if scope is not defined', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/myself/tokens',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
          body: {},
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(400)
          expect(response.json().reason).toEqual("body must have required property 'scope'")
        },
      )
    })

    it('should return 400 if no scope is enabled', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/myself/tokens',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
          body: {
            scope: {
              read: false,
              write: false,
            },
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(400)
          expect(response.json().reason).toEqual('please, specify the token scope')
        },
      )
    })

    it('should return 400 if token ID does not exists', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: `/myself/tokens/myfaketoken`,
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(404)
          expect(response.json().reason).toEqual('token not found')
        },
      )
    })

    it('should delete token', (done) => {
      server.accountsRepository.findAccountBySubject('macario@cheetos.io').then((account) => {
        const tokenId = account?.api_tokens[1].id

        server.inject(
          {
            method: 'DELETE',
            url: `/myself/tokens/${tokenId}`,
            headers: {
              authorization: `Bearer ${macarioToken}`,
            },
          },
          (_err, response) => {
            done()
            expect(response.statusCode).toStrictEqual(200)
          },
        )
      })
    })
  })

  describe('GET /myself', () => {
    it('should retrieve account', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/myself',
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          const account = response.json()
          done()
          expect(response.statusCode).toStrictEqual(200)
          expect(account).toBeDefined()
          expect(account.status).toBe('enabled')
          expect(account.subject).toBe('macario@cheetos.io')
        },
      )
    })

    it('should delete account', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: `/myself`,
          headers: {
            authorization: `Bearer ${macarioToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response.statusCode).toStrictEqual(200)
        },
      )
    })

    it('should not allow account deletion with public token', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: `/myself`,
          headers: {
            authorization: `Bearer ${publicToken}`,
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
