import { FastifyInstance } from 'fastify'

import '../../testing/network.js'

import { mockServer } from '../../testing/server.js'

describe.skip('admin api', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await mockServer({
      jwtAuth: true,
    })
    return server.ready()
  })

  afterAll(() => {
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
