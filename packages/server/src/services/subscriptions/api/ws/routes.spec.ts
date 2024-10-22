import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { mockServer } from '@/testing/server.js'

describe('ws api', () => {
  let server: FastifyInstance
  const validToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6InB1YmxpY0BvY2VsbG9pZHMiLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.eD5EBUclmJp6oyLS_FECuZxUDr_QUp5ISqzTu4H6LiOq_fjLZFJoWdfRZLpGnp5AgOI7rO7LpeiV60wMePW9Aw'
  const invalidToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInN1YiI6Im1hY2FyaW8iLCJpc3MiOiJ0ZXN0IiwiaWF0IjoxNzIxNjQ2NjE5fQ.TR6eH5XPxSG-fboGrMjlUAzeUL3zyUifu56DK2_bssU8nUKXXacUhvCeLW6zdsuTFAq6gm5rRL9pvbp0n8I2Bg'
  const testAntiDosToken =
    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MjE2NDk4NTAsImlzcyI6InRlc3QifQ.bBh6q3W6KDXzeB_G2KYPYnHaUJ3olB-uxQyevf7gDHbxLpeG86g6QwewqGe1PbgwBZM1IUIfutmGzULzKpW3Aw'

  beforeAll(async () => {
    server = await mockServer({
      jwtAuth: true,
      jwtSigKeyFile: 'keys',
    })
    return server.ready()
  })

  afterAll(() => {
    return server.close()
  })

  it('should return jwt in nod protocol', async () => {
    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'GET',
          url: '/ws/nod',
          headers: {
            authorization: `Bearer ${validToken}`,
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

  it('should return unauthorized for invalid subject', async () => {
    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'GET',
          url: '/ws/nod',
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

  it('should return 404 if no subscription is made', async () => {
    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'GET',
          url: `/ws/subs/xcm/macatron?nod=${testAntiDosToken}`,
          headers: {
            authorization: `Bearer ${validToken}`,
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
