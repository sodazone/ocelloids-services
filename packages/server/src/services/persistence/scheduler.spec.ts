import { jest } from '@jest/globals';

import { MemoryLevel as Level } from 'memory-level';

import { _config, _log } from '../../testing/services';
import { Scheduler } from './scheduler';

jest.useFakeTimers();

describe('scheduler service', () => {
  let scheduler: Scheduler;
  let db: Level;
  let now: any;

  beforeEach(() => {
    db = new Level();
    scheduler = new Scheduler(_log, db, {
      schedulerFrequency: 500,
      scheduler: true,
    });
    now = jest.spyOn(Date, 'now').mockImplementation(() => 0);
  });

  afterEach(() => {
    now.mockRestore();
  });

  it('should schedule and execute a task', async () => {
    const ok = jest.fn();
    scheduler.start();
    scheduler.on('task', ok);

    await scheduler.schedule({
      key: new Date(Date.now()).toISOString() + 'a',
      type: 'task',
      task: {},
    });

    expect((await scheduler.allTaskTimes()).length).toBe(1);

    now.mockImplementation(() => 1000);
    jest.advanceTimersByTime(1000);

    await scheduler.stop();

    expect(ok).toBeCalled();
  });

  it('should remove a task', async () => {
    const key = new Date(Date.now()).toISOString() + 'a';

    await scheduler.schedule({
      key,
      type: 'task',
      task: {},
    });

    expect((await scheduler.allTaskTimes()).length).toBe(1);

    await scheduler.remove(key);

    expect((await scheduler.allTaskTimes()).length).toBe(0);
  });

  it('should schedule and execute due tasks', async () => {
    const ok = jest.fn();
    scheduler.start();
    scheduler.on('task', ok);

    const time = Date.now();

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
      }
    );

    expect((await scheduler.allTaskTimes()).length).toBe(3);

    now.mockImplementation(() => 1000);
    jest.advanceTimersByTime(1000);

    await scheduler.stop();

    expect(ok).toHaveBeenCalledTimes(2);
  });
});
