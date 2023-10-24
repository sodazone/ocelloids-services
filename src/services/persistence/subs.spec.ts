import { MemoryLevel as Level } from 'memory-level';

import { SubsStore } from './subs';
import { _config, _log } from '../../test/services';
import { QuerySubscription } from '../monitoring/types';
import { _subsFix } from '../../test/data';

describe('subscriptions persistence', () => {
  let db: SubsStore;

  async function expectUpdate(
    original: QuerySubscription,
    modification: any
  ) {
    const modified = {
      ...original,
      ...modification
    };
    const prevWithNewId = {
      ...original,
      id: 'NID:' + original.id
    };

    await db.save(modified);

    await expect(async () => {
      await db.save(prevWithNewId);
    }).rejects.toThrowError();

    await db.updateUniquePaths(original, modified);
    await db.save(prevWithNewId);

    expect(await db.exists(prevWithNewId.id)).toBe(true);
  }

  beforeAll(() => {
    const mem = new Level();
    db = new SubsStore(
      _log,
      mem,
      _config
    );
  });

  describe('prepare data', () => {
    it('should insert subscriptions fix', async () => {
      for (const sub of _subsFix) {
        await db.insert(sub);
      }
      expect((await db.getAll()).length).toBe(5);
    });
  });

  describe('modify subscriptions', () => {
    it('should prevent duplicate ids', async () => {
      await expect(async () => {
        await db.insert(_subsFix[0]);
      }).rejects.toThrowError();
    });
    it('should remove subsciption by id', async () => {
      const subs = await db.getAll();
      await db.remove(subs[subs.length - 1].id);
      expect((await db.getAll()).length).toBe(subs.length - 1);
    });
    it('should prevent unconfigured chain ids', async () => {
      await expect(async () => {
        await db.save({
          ..._subsFix[0],
          origin: 1337
        });
      }).rejects.toThrowError();
      await expect(async () => {
        await db.save({
          ..._subsFix[0],
          destinations: [1337]
        });
      }).rejects.toThrowError();
    });
    it('should enforce unique paths', async () => {
      await expect(async () => {
        await db.insert({
          ..._subsFix[0],
          id: 'Z-0:1000:1',
          origin: 0,
          destinations: [
            1000
          ],
          senders: ['a']
        });
      }).rejects.toThrowError();
    });

    it('should update uniques on senders modification', async () => {
      await expectUpdate(
        _subsFix[0],
        {
          senders: ['y'],
        }
      );
    });

    it('should update uniques on destinations modification', async () => {
      await expectUpdate(
        _subsFix[1],
        {
          destinations: [
            3000
          ]
        }
      );
    });

    it('should update uniques on senders and destinations modification', async () => {
      await expectUpdate(
        _subsFix[2],
        {
          senders: ['ALICE', 'BOB'],
          destinations: [
            3000
          ]
        }
      );
    });
  });
});