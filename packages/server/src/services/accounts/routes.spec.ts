import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { invalidToken, publicToken, rootToken } from '@/testing/data.js'
import { flushPromises } from '@/testing/promises.js'
import { mockServer } from '@/testing/server.js'

import { CAP_READ, CAP_WRITE } from '../auth/caps.js'

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
        url: '/accounts/invite?subject=pepe@frog.com&expiresIn=315569520',
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
    it('should return tokens for macario account', async () => {
      await new Promise<void>((resolve) => {
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
            expect(response?.statusCode).toStrictEqual(200)
            expect(tokens).toBeDefined()
            expect(tokens.length).toBe(1)
            resolve()
          },
        )
      })
    })

    it('should create new token for macario account', async () => {
      await new Promise<void>((resolve) => {
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
            expect(response?.statusCode).toStrictEqual(200)
            expect(response?.json().token).toBeDefined()
            resolve()
          },
        )
      })
    })

    it('should return 400 if scope is not defined', async () => {
      await new Promise<void>((resolve) => {
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
            expect(response?.statusCode).toStrictEqual(400)
            expect(response?.json().reason).toEqual("body must have required property 'scope'")
            resolve()
          },
        )
      })
    })

    it('should return 400 if no scope is enabled', async () => {
      await new Promise<void>((resolve) => {
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
            expect(response?.statusCode).toStrictEqual(400)
            expect(response?.json().reason).toEqual('please, specify the token scope')
            resolve()
          },
        )
      })
    })

    it('should return 400 if token ID does not exists', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: `/myself/tokens/myfaketoken`,
            headers: {
              authorization: `Bearer ${macarioToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(404)
            expect(response?.json().reason).toEqual('token not found')
            resolve()
          },
        )
      })
    })

    it('should delete token', async () => {
      await new Promise<void>((resolve) => {
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
              expect(response?.statusCode).toStrictEqual(200)
              resolve()
            },
          )
        })
      })
    })
  })

  describe('/accounts/token', () => {
    it('should update token scopes', async () => {
      const { id } = await server.accountsRepository.createAccount({
        status: 'enabled',
        subject: 'to-test',
      })
      await server.accountsRepository.createApiToken({
        account_id: id,
        scope: [CAP_WRITE].join(' '),
        status: 'enabled',
        id: 'test-token',
      })

      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'PATCH',
            url: '/accounts/tokens/test-token',
            headers: {
              authorization: `Bearer ${rootToken}`,
            },
            body: {
              scope: {
                read: true,
              },
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(200)
            resolve()
          },
        )
      })

      expect((await server.accountsRepository.findApiTokenById('test-token'))?.scope).toBe(CAP_READ)
    })

    it('only admin can update token scopes', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'PATCH',
            url: '/accounts/tokens/test-token',
            headers: {
              authorization: `Bearer ${macarioToken}`,
            },
            body: {
              scope: {
                read: true,
              },
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(401)
            resolve()
          },
        )
      })
    })
  })

  describe('/myself', () => {
    it('should retrieve account', async () => {
      await new Promise<void>((resolve) => {
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
            expect(response?.statusCode).toStrictEqual(200)
            expect(account).toBeDefined()
            expect(account.status).toBe('enabled')
            expect(account.subject).toBe('macario@cheetos.io')
            resolve()
          },
        )
      })
    })

    it('should delete account', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: `/myself`,
            headers: {
              authorization: `Bearer ${macarioToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(200)
            resolve()
          },
        )
      })
    })

    it('should not allow account deletion with public token', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: `/myself`,
            headers: {
              authorization: `Bearer ${publicToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(401)
            resolve()
          },
        )
      })
    })
  })

  describe('/accounts/invite', () => {
    it('should create a token on invite', async () => {
      const createAccountSpy = vi.spyOn(server.accountsRepository, 'createAccount')

      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'GET',
            url: '/accounts/invite?subject=doge@dog.com',
            headers: {
              authorization: `Bearer ${rootToken}`,
            },
          },
          (_err, response) => {
            expect(createAccountSpy).toHaveBeenCalled()
            expect(response?.statusCode).toStrictEqual(200)
            expect(response?.json().token).toBeDefined()
            resolve()
          },
        )
      })
    })

    it('should return 400 if token creation fails', async () => {
      vi.spyOn(server.accountsRepository, 'createApiToken').mockImplementationOnce(() =>
        Promise.reject('test error'),
      )
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'GET',
            url: '/accounts/invite?subject=shiba@dog.com',
            headers: {
              authorization: `Bearer ${rootToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(400)
            resolve()
          },
        )
      })
    })

    it('should return 401 on invalid token', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'GET',
            url: '/accounts/invite?subject=macario',
            headers: {
              authorization: `Bearer ${invalidToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(401)
            resolve()
          },
        )
      })
    })

    it('should return 401 on a valid non-root token', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'GET',
            url: '/accounts/invite?subject=macario',
            headers: {
              authorization: `Bearer ${publicToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(401)
            resolve()
          },
        )
      })
    })
  })

  describe('/account/:subject', () => {
    it('only admin could delete accounts', async () => {
      const deleteAccountSpy = vi.spyOn(server.accountsRepository, 'deleteAccount')

      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: '/account/pepe@frog.com',
            headers: {
              authorization: `Bearer ${pepeToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(401)
            expect(deleteAccountSpy).not.toHaveBeenCalled()
            resolve()
          },
        )
      })
    })

    it('should allow root to delete account', async () => {
      const deleteAccountSpy = vi.spyOn(server.accountsRepository, 'deleteAccount')

      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: '/account/pepe@frog.com',
            headers: {
              authorization: `Bearer ${rootToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(200)
            expect(deleteAccountSpy).toHaveBeenCalled()
            resolve()
          },
        )
      })
    })

    it('should return 404 if account to delete is not found', async () => {
      await new Promise<void>((resolve) => {
        server.inject(
          {
            method: 'DELETE',
            url: '/account/pepe@frog.com',
            headers: {
              authorization: `Bearer ${rootToken}`,
            },
          },
          (_err, response) => {
            expect(response?.statusCode).toStrictEqual(404)
            resolve()
          },
        )
      })
    })
  })
})
