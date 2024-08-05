import { jest } from '@jest/globals'

import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { invalidToken, publicToken, rootToken } from '@/testing/data.js'
import { flushPromises } from '@/testing/promises.js'
import { mockServer } from '@/testing/server.js'

describe('accounts api', () => {
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
        macarioToken = response?.json().token
      },
    )
    server.inject(
      {
        method: 'GET',
        url: '/accounts/invite?subject=pepe@frog.com',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        pepeToken = response?.json().token
      },
    )

    await flushPromises()
  })

  afterAll(() => {
    return server.close()
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
          const tokens = response?.json()
          done()
          expect(response?.statusCode).toStrictEqual(200)
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
          expect(response?.statusCode).toStrictEqual(200)
          expect(response?.json().token).toBeDefined()
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
          expect(response?.statusCode).toStrictEqual(400)
          expect(response?.json().reason).toEqual("body must have required property 'scope'")
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
          expect(response?.statusCode).toStrictEqual(400)
          expect(response?.json().reason).toEqual('please, specify the token scope')
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
          expect(response?.statusCode).toStrictEqual(404)
          expect(response?.json().reason).toEqual('token not found')
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
            expect(response?.statusCode).toStrictEqual(200)
          },
        )
      })
    })
  })

  describe('/myself', () => {
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
          const account = response?.json()
          done()
          expect(response?.statusCode).toStrictEqual(200)
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
          expect(response?.statusCode).toStrictEqual(200)
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
          expect(response?.statusCode).toStrictEqual(401)
        },
      )
    })
  })

  describe('/accounts/invite', () => {
    it('should create a token on invite', (done) => {
      const createAccountSpy = jest.spyOn(server.accountsRepository, 'createAccount')

      server.inject(
        {
          method: 'GET',
          url: '/accounts/invite?subject=doge@dog.com',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(createAccountSpy).toHaveBeenCalled()
          expect(response?.statusCode).toStrictEqual(200)
          expect(response?.json().token).toBeDefined()
        },
      )
    })

    it('should return 400 if token creation fails', (done) => {
      jest
        .spyOn(server.accountsRepository, 'createApiToken')
        .mockImplementationOnce(() => Promise.reject('test error'))
      server.inject(
        {
          method: 'GET',
          url: '/accounts/invite?subject=shiba@dog.com',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response?.statusCode).toStrictEqual(400)
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
          expect(response?.statusCode).toStrictEqual(401)
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
          expect(response?.statusCode).toStrictEqual(401)
        },
      )
    })
  })

  describe('/account/:subject', () => {
    it('should not allow non-admin to delete account from this endpoint', (done) => {
      const deleteAccountSpy = jest.spyOn(server.accountsRepository, 'deleteAccount')

      server.inject(
        {
          method: 'DELETE',
          url: '/account/pepe@frog.com',
          headers: {
            authorization: `Bearer ${pepeToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response?.statusCode).toStrictEqual(401)
          expect(deleteAccountSpy).not.toHaveBeenCalled()
        },
      )
    })

    it('should allow root to delete account', (done) => {
      const deleteAccountSpy = jest.spyOn(server.accountsRepository, 'deleteAccount')

      server.inject(
        {
          method: 'DELETE',
          url: '/account/pepe@frog.com',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response?.statusCode).toStrictEqual(200)
          expect(deleteAccountSpy).toHaveBeenCalled()
        },
      )
    })

    it('should return 404 if account to delete is not found', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: '/account/pepe@frog.com',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          done()
          expect(response?.statusCode).toStrictEqual(404)
        },
      )
    })
  })
})
