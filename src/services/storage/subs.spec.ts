import { MemoryLevel as Level } from 'memory-level';
import { SubsDB } from './subs';
import { _Config, _Pino } from '../../_mocks/services';
import { QuerySubscription } from '../monitoring/types';

const subsFix : QuerySubscription[] = [
  {
    id: '0:1000:1',
    origin: 0,
    destinations: [
      1000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '0:1000:2',
    origin: 0,
    destinations: [
      1000
    ],
    senders: ['d', 'e', 'f'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '0:2000:1',
    origin: 0,
    destinations: [
      2000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '100:0-2000:1',
    origin: 1000,
    destinations: [
      0, 2000
    ],
    senders: ['a', 'b', 'c'],
    notify: {
      type: 'log'
    }
  },
  {
    id: '100:0-2000:2',
    origin: 1000,
    destinations: [
      0, 2000
    ],
    senders: ['d', 'e', 'f'],
    notify: {
      type: 'log'
    }
  },
];

describe('subscriptions database', () => {
  let db: SubsDB;

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
    db = new SubsDB(
      _Pino,
      mem,
      _Config
    );
  });

  describe('prepare data', () => {
    it('should insert subscriptions fix', async () => {
      for (const sub of subsFix) {
        await db.insert(sub);
      }
      for (const sub of subsFix) {
        expect(await db.exists(sub.id)).toBe(true);
      }
    });
  });

  describe('modify subscriptions', () => {
    it('should prevent duplicate ids', async () => {
      await expect(async () => {
        await db.insert(subsFix[0]);
      }).rejects.toThrowError();
    });
    it('should enforce unique paths', async () => {
      await expect(async () => {
        await db.insert({
          ...subsFix[0],
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
        subsFix[0],
        {
          senders: ['y'],
        }
      );
    });

    it('should update uniques on destinations modification', async () => {
      await expectUpdate(
        subsFix[1],
        {
          destinations: [
            3000
          ]
        }
      );
    });

    it('should update uniques on senders and destinations modification', async () => {
      await expectUpdate(
        subsFix[2],
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