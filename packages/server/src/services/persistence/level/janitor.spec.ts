import { MemoryLevel as Level } from 'memory-level'

import { flushPromises } from '@/testing/promises.js'
import { _config, _log } from '@/testing/services.js'

import { Janitor } from './janitor.js'
import { Scheduler } from './scheduler.js'

vi.useFakeTimers()

describe('janitor service', () => {
  let janitor: Janitor
  let scheduler: Scheduler
  let db: Level
  let now: any

  beforeEach(() => {
    db = new Level()
    scheduler = new Scheduler(_log, db, {
      schedulerFrequency: 500,
      scheduler: true,
    })
    janitor = new Janitor(_log, db, scheduler, {
      sweepExpiry: 500,
    })
    now = vi.spyOn(Date, 'now').mockImplementation(() => 0)
  })

  afterEach(() => {
    now.mockRestore()
  })

  it('should schedule and execute a task', async () => {
    const s1 = db.sublevel('s1')
    await s1.batch().put('k1', '').put('k2', '').write()

    scheduler.start()

    await janitor.schedule({
      key: 'k1',
      sublevel: 's1',
    })

    expect((await scheduler.allTaskTimes()).length).toBe(1)
    await expect(s1.get('k1')).resolves.toBeDefined()

    now.mockImplementation(() => 1000)
    vi.advanceTimersByTime(1000)

    await scheduler.stop()

    await flushPromises()

    vi.advanceTimersByTime(1)
    await flushPromises()

    await expect(async () => {
      await s1.get('k1')
    }).rejects.toThrow()

    await expect(s1.get('k2')).resolves.toBeDefined()
  })

  it('should skip future tasks', async () => {
    const s1 = db.sublevel('s1')
    await s1.batch().put('k1', '').put('k2', '').put('k3', '').write()

    scheduler.start()

    await janitor.schedule(
      {
        key: 'k1',
        sublevel: 's1',
      },
      {
        key: 'k2',
        sublevel: 's1',
      },
      {
        key: 'k3',
        sublevel: 's1',
        expiry: 2000,
      },
    )

    expect((await scheduler.allTaskTimes()).length).toBe(3)
    expect(await s1.get('k1')).toBeDefined()

    now.mockImplementation(() => 1000)
    vi.advanceTimersByTime(1000)

    await scheduler.stop()

    await flushPromises()

    await expect(async () => {
      await s1.get('k1')
    }).rejects.toThrow()

    expect((await scheduler.allTaskTimes()).length).toBe(1)
    expect(await s1.get('k3')).toBeDefined()

    scheduler.start()
    now.mockImplementation(() => 2500)
    vi.advanceTimersByTime(2500)

    await scheduler.stop()

    await flushPromises()

    vi.advanceTimersByTime(1)
    await flushPromises()

    await expect(async () => {
      await s1.get('k3')
    }).rejects.toThrow()
  })

  it('should avoid key collisions', async () => {
    const p: Promise<void>[] = []
    for (let i = 0; i < 10; i++) {
      p.push(
        janitor.schedule({
          key: 'k' + i,
          sublevel: 's',
        }),
      )
    }
    await Promise.all(p)
    expect((await scheduler.allTaskTimes()).length).toBe(10)
  })

  it('should continue if the tasks fails', async () => {
    const s1 = db.sublevel('s1')
    await s1.batch().put('k1', '').put('k2', '').put('k3', '').write()

    scheduler.start()

    await janitor.schedule(
      {
        key: 'k2',
        sublevel: 's1',
      },
      {
        key: 'no',
        sublevel: 'no',
      },
      {
        key: 'k1',
        sublevel: 's1',
      },
    )

    expect((await scheduler.allTaskTimes()).length).toBe(3)

    now.mockImplementation(() => 1000)
    vi.advanceTimersByTime(1000)

    await scheduler.stop()

    expect((await scheduler.allTaskTimes()).length).toBe(0)
    expect((await s1.keys().all()).length).toBe(1)
    expect(await s1.get('k3')).toBeDefined()
  })
})
