import { jest } from '@jest/globals'

import { FastifyInstance } from 'fastify'

import '@/testing/network.js'

import { rootToken } from '@/testing/data.js'
import { mockServer } from '@/testing/server.js'

describe('admin api', () => {
  let server: FastifyInstance

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
        expect(response?.statusCode).toStrictEqual(401)
      },
    )
  })

  it('should retrieve pending scheduler tasks', (done) => {
    const allTaskTimesSpy = jest.spyOn(server.scheduler, 'allTaskTimes')

    server.inject(
      {
        method: 'GET',
        url: '/admin/sched',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        done()
        expect(response?.statusCode).toStrictEqual(200)
        expect(allTaskTimesSpy).toHaveBeenCalled()
      },
    )
  })

  it('should retrieve pending scheduler task by id', (done) => {
    const taskId = 'test'
    const getByIdSpy = jest.spyOn(server.scheduler, 'getById')
    getByIdSpy.mockImplementationOnce(() => Promise.resolve({}))

    server.inject(
      {
        method: 'GET',
        url: `/admin/sched?key=${taskId}`,
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        done()
        expect(response?.statusCode).toStrictEqual(200)
        expect(getByIdSpy).toHaveBeenCalledWith(taskId)
      },
    )
  })

  it('should delete scheduler task by id', (done) => {
    const taskId = 'test'
    const removeSpy = jest.spyOn(server.scheduler, 'remove')
    removeSpy.mockImplementationOnce(() => Promise.resolve())

    server.inject(
      {
        method: 'DELETE',
        url: `/admin/sched?key=${taskId}`,
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        done()
        expect(response?.statusCode).toStrictEqual(200)
        expect(removeSpy).toHaveBeenCalledWith(taskId)
      },
    )
  })

  it('should retrieve cached blocks', (done) => {
    server.inject(
      {
        method: 'GET',
        url: '/admin/cache/urn:ocn:local:0',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        const cached = response?.json()
        done()
        expect(response?.statusCode).toStrictEqual(200)
        expect(cached).toBeDefined()
        expect(cached.length).toBe(0)
      },
    )
  })

  it('should delete cached blocks', (done) => {
    const dbClearSpy = jest.spyOn(server.levelDB, 'clear')

    server.inject(
      {
        method: 'DELETE',
        url: '/admin/cache/urn:ocn:local:0',
        headers: {
          authorization: `Bearer ${rootToken}`,
        },
      },
      (_err, response) => {
        done()
        expect(response?.statusCode).toStrictEqual(200)
        expect(dbClearSpy).toHaveBeenCalled()
      },
    )
  })
})
