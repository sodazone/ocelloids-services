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

  it('should return unauthorized for invalid tokens', async () => {
    await new Promise<void>((resolve) => {
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
          expect(response?.statusCode).toStrictEqual(401)
          resolve()
        },
      )
    })
  })

  it('should delete a sublevel', async () => {
    const db = server.levelDB.sublevel('deleteme')
    await db.put('a', '1')
    expect(await db.get('a')).toBe('1')

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'DELETE',
          url: '/admin/level/deleteme',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          resolve()
        },
      )
    })

    await expect(db.get('a')).rejects.toThrow()
  })

  it('should schedule a task', async () => {
    const scheduleSpy = vi.spyOn(server.scheduler, 'schedule')
    const timeString = new Date(Date.now() + 10_000_000).toISOString()
    const key = timeString + 'something'

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'POST',
          url: '/admin/sched',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
          body: {
            key,
            type: 'something',
            task: null,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          expect(scheduleSpy).toHaveBeenCalled()
          resolve()
        },
      )
    })
  })

  it('should retrieve pending scheduler tasks', async () => {
    const allTaskTimesSpy = vi.spyOn(server.scheduler, 'allTaskTimes')

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'GET',
          url: '/admin/sched',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          expect(allTaskTimesSpy).toHaveBeenCalled()
          resolve()
        },
      )
    })
  })

  it('should retrieve pending scheduler task by id', async () => {
    const taskId = 'test'
    const getByIdSpy = vi.spyOn(server.scheduler, 'getById')
    getByIdSpy.mockImplementationOnce(() => Promise.resolve({}))

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'GET',
          url: `/admin/sched?key=${taskId}`,
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          expect(getByIdSpy).toHaveBeenCalledWith(taskId)
          resolve()
        },
      )
    })
  })

  it('should delete scheduler task by id', async () => {
    const taskId = 'test'
    const removeSpy = vi.spyOn(server.scheduler, 'remove')
    removeSpy.mockImplementationOnce(() => Promise.resolve())

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'DELETE',
          url: `/admin/sched?key=${taskId}`,
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          expect(removeSpy).toHaveBeenCalledWith(taskId)
          resolve()
        },
      )
    })
  })

  it('should retrieve cached blocks', async () => {
    await new Promise<void>((resolve) => {
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
          expect(response?.statusCode).toStrictEqual(200)
          expect(cached).toBeDefined()
          expect(cached.length).toBe(0)
          resolve()
        },
      )
    })
  })

  it('should delete cached blocks', async () => {
    const dbClearSpy = vi.spyOn(server.levelDB, 'clear')

    await new Promise<void>((resolve) => {
      server.inject(
        {
          method: 'DELETE',
          url: '/admin/cache/urn:ocn:local:0',
          headers: {
            authorization: `Bearer ${rootToken}`,
          },
        },
        (_err, response) => {
          expect(response?.statusCode).toStrictEqual(200)
          expect(dbClearSpy).toHaveBeenCalled()
          resolve()
        },
      )
    })
  })
})
