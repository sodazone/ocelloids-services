import { FastifyInstance, InjectOptions } from 'fastify'

import { jsonEncoded, prefixes } from '../../services/types.js'

import '../../testing/network.js'

import { mockServer } from '../../testing/server.js'

describe('admin api', () => {
  const OLD_ENV = process.env
  let server: FastifyInstance

  beforeAll(async () => {
    process.env.OC_SECRET = 'abc'

    server = await mockServer()

    const { db } = server

    await db
      .sublevel<string, any>(prefixes.sched.tasks, jsonEncoded)
      .batch()
      .put('0000', { type: 'a', task: {} })
      .put('0001', { type: 'b', task: {} })
      .write()

    await db.sublevel<string, any>(prefixes.cache.tips, jsonEncoded).batch().put('0', {}).put('1', {}).write()
    for (let i = 0; i < 3; i++) {
      await db
        .sublevel<string, any>(prefixes.cache.family(`urn:ocn:local:${i.toString()}`), jsonEncoded)
        .put('0x0', {})
    }
    return server.ready()
  })

  afterAll(() => {
    process.env = OLD_ENV
    return server.close()
  })

  function adminRq(url: string, method = 'GET') {
    return {
      method,
      url,
      headers: {
        authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwIiwiaWF0IjoxNTE2MjM5MDIyfQ.yRR0A3R3p-mWuHv6MRH1oFZ47Pk0-1hqvFEUWe-o3o8',
      },
    } as InjectOptions
  }

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

  it('should query tips cache', (done) => {
    server.inject(adminRq('/admin/cache/tips'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
      expect(JSON.parse(response.body).length).toBe(2)
    })
  })

  it('should clear tips cache', (done) => {
    server.inject(adminRq('/admin/cache/tips', 'DELETE'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
    })
  })

  it('should get cache data', (done) => {
    server.inject(adminRq('/admin/cache/urn:ocn:local:0'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
    })
  })

  it('should delete cache data', (done) => {
    server.inject(adminRq('/admin/cache/urn:ocn:local:1', 'DELETE'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
    })
  })

  it('should get scheduled tasks', (done) => {
    server.inject(adminRq('/admin/sched'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
      expect(JSON.parse(response.body).length).toBe(2)
    })
  })

  it('should get an scheduled task', (done) => {
    server.inject(adminRq('/admin/sched?key=0000'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
    })
  })

  it('should delete an scheduled task', (done) => {
    server.inject(adminRq('/admin/sched?key=0001', 'DELETE'), (_err, response) => {
      done()
      expect(response.statusCode).toStrictEqual(200)
    })
  })
})
