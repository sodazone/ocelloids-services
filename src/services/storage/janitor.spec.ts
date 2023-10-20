import { MemoryLevel as Level } from 'memory-level';

import { _Config, _Pino } from '../../_mocks/services';
import { Janitor } from './janitor';

jest.useFakeTimers();

describe('janitor service', () => {
  let janitor : Janitor;
  let db : Level;
  let now: jest.SpyInstance;

  beforeEach(() => {
    db = new Level();
    janitor = new Janitor(
      _Pino,
      db,
      {
        sweepInterval: 500,
        sweepExpiry: 500,
        janitor: true
      }
    );
    now = jest.spyOn(Date, 'now')
      .mockImplementation(() => 0);

    janitor.start();
  });

  afterEach(() => {
    now.mockRestore();
  });

  it('should schedule and execute a task', async () => {
    const s1 = db.sublevel('s1');
    await s1.batch()
      .put('k1', '')
      .put('k2', '')
      .write();

    await janitor.schedule({
      key: 'k1',
      sublevel: 's1'
    });

    expect((await janitor.allTaskTimes()).length).toBe(1);
    expect(await s1.get('k1')).toBeDefined();

    now.mockImplementation(() => 1000);
    jest.advanceTimersByTime(1000);

    await janitor.stop();

    await expect(async () => {
      await s1.get('k1');
    }).rejects.toThrowError();

    expect(await s1.get('k2')).toBeDefined();
  });

  it('should skip future tasks', async () => {
    const s1 = db.sublevel('s1');
    await s1.batch()
      .put('k1', '')
      .put('k2', '')
      .put('k3', '')
      .write();

    await janitor.schedule({
      key: 'k1',
      sublevel: 's1'
    }, {
      key: 'k2',
      sublevel: 's1'
    }, {
      key: 'k3',
      sublevel: 's1',
      expiry: 2000
    });

    expect((await janitor.allTaskTimes()).length).toBe(3);
    expect(await s1.get('k1')).toBeDefined();

    now.mockImplementation(() => 1000);
    jest.advanceTimersByTime(1000);

    await janitor.stop();

    await expect(async () => {
      await s1.get('k1');
    }).rejects.toThrowError();

    expect((await janitor.allTaskTimes()).length).toBe(1);
    expect(await s1.get('k3')).toBeDefined();

    janitor.start();
    now.mockImplementation(() => 2500);
    jest.advanceTimersByTime(2500);

    await janitor.stop();

    await expect(async () => {
      await s1.get('k3');
    }).rejects.toThrowError();
  });

  it('should avoid key collisions', async () => {
    now.mockRestore();

    const p : Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      p.push(janitor.schedule({
        key: 'k' + i,
        sublevel: 's'
      }));
    }
    await Promise.all(p);
    expect((await janitor.allTaskTimes()).length).toBe(10);
  });
});