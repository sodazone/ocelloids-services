import { FastifyInstance } from 'fastify'

import '../../testing/network.js'

import { mockServer } from '../../testing/server.js'

describe('admin api', () => {
  const OLD_ENV = process.env
  let server: FastifyInstance

  beforeAll(async () => {
    process.env.OC_SECRET = 'abc'

    server = await mockServer()
    return server.ready()
  })

  afterAll(() => {
    process.env = OLD_ENV
    return server.close()
  })

  it('should return unauthorized for invalid tokens', (done) => {
    server.inject(
      {
        method: 'GET',
        url: '/admin/sched',
        headers: {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.VAxxu2QZ2pPsTFklm7IS1Qc7p0E6_FQoiibkDZc9cio',
        },
      },
      (_err, response) => {
        done()
        expect(response.statusCode).toStrictEqual(401)
      },
    )
  })
})
