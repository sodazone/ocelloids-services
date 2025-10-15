import { MemoryLevel } from 'memory-level'

import { LevelDB } from '@/services/types.js'
import { _log } from '@/testing/services.js'
import { Scheduler } from './scheduler.js'

vi.useFakeTimers()

describe('scheduler service', () => {
  let scheduler: Scheduler
  let db: LevelDB
  let now: any

  beforeEach(async () => {
    db = new MemoryLevel() as LevelDB
    scheduler = new Scheduler(_log, db, {
      schedulerFrequency: 500,
      scheduler: true,
    })
    now = vi.spyOn(Date, 'now').mockImplementation(() => 0)

    return scheduler.__open()
  })

  afterEach(() => {
    now.mockRestore()
  })

  it('should schedule and execute a task', async () => {
    const ok = vi.fn()
    scheduler.start()
    scheduler.on('task', ok)

    await scheduler.schedule({
      key: new Date(Date.now()).toISOString() + 'a',
      type: 'task',
      task: {},
    })

    expect((await scheduler.allTaskTimes()).length).toBe(1)

    now.mockImplementation(() => 1000)
    vi.advanceTimersByTime(1000)

    await scheduler.stop()

    expect(ok).toHaveBeenCalled()
  })

  it('should remove a task', async () => {
    const key = new Date(Date.now()).toISOString() + 'a'

    await scheduler.schedule({
      key,
      type: 'task',
      task: {},
    })

    expect((await scheduler.allTaskTimes()).length).toBe(1)

    await scheduler.remove(key)

    expect((await scheduler.allTaskTimes()).length).toBe(0)
  })

  it('should schedule and execute due tasks', async () => {
    const ok = vi.fn()
    scheduler.start()
    scheduler.on('task', ok)

    const time = Date.now()

    await scheduler.schedule(
      {
        key: new Date(time).toISOString() + 'a',
        type: 'task',
        task: {},
      },
      {
        key: new Date(time + 100).toISOString() + 'b',
        type: 'task',
        task: {},
      },
      {
        key: new Date(time + 2000).toISOString() + 'c',
        type: 'task',
        task: {},
      },
    )

    expect((await scheduler.allTaskTimes()).length).toBe(3)

    now.mockImplementation(() => 1000)
    vi.advanceTimersByTime(1000)

    await scheduler.stop()

    expect(ok).toHaveBeenCalledTimes(2)
  })

  it('should check if there are already scheduled tasks', async () => {
    const now = new Date(Date.now()).toISOString()

    await scheduler.schedule({
      key: now + 'a',
      type: 'task',
      task: {},
    })
    await scheduler.schedule({
      key: now + 'b',
      type: 'task',
      task: {},
    })
    await scheduler.schedule({
      key: now + 'c',
      type: 'bask',
      task: {},
    })

    expect((await scheduler.allTaskTimes()).length).toBe(3)

    expect(await scheduler.hasScheduled((key) => key.endsWith('a'))).toBe(true)
    expect(
      await scheduler.hasScheduled((_key, value) => value?.type === 'task', { includeValues: true }),
    ).toBe(true)
  })
})
