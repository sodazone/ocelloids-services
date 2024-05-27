import { MemoryLevel as Level } from 'memory-level'

import { _subsFix } from '../../testing/data'
import { _ingress, _log } from '../../testing/services'
import { SubsStore } from './subs'

describe('subscriptions persistence', () => {
  let db: SubsStore

  beforeAll(() => {
    const mem = new Level()
    db = new SubsStore(_log, mem, _ingress)
  })

  describe('prepare data', () => {
    it('should insert subscriptions fix', async () => {
      for (const sub of _subsFix) {
        await db.insert(sub)
      }
      expect((await db.getAll()).length).toBe(5)
    })
  })

  describe('modify subscriptions', () => {
    it('should prevent duplicate ids', async () => {
      await expect(async () => {
        await db.insert(_subsFix[0])
      }).rejects.toThrow()
    })

    it('should remove subsciption by id', async () => {
      const subs = await db.getAll()
      await db.remove(subs[subs.length - 1].id)
      expect((await db.getAll()).length).toBe(subs.length - 1)
    })

    it('should prevent unconfigured chain ids', async () => {
      await expect(async () => {
        await db.save({
          ..._subsFix[0],
          origin: 'urn:ocn:local:1337',
        })
      }).rejects.toThrow()
      await expect(async () => {
        await db.save({
          ..._subsFix[0],
          destinations: ['urn:ocn:local:1337'],
        })
      }).rejects.toThrow()
    })

    it('should allow multiple subscription for the same conditions', async () => {
      const len = (await db.getAll()).length
      await db.insert({
        ..._subsFix[0],
        id: 'Z-0:1000:1',
        origin: 'urn:ocn:local:0',
        destinations: ['urn:ocn:local:1000'],
        senders: ['a'],
      })
      expect((await db.getAll()).length).toBe(len + 1)
    })
  })
})
