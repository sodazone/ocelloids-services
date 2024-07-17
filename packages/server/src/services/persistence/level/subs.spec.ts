import { MemoryLevel as Level } from 'memory-level'

import { _subsFix, _testAgentId } from '@/testing/data.js'
import { _ingress, _log } from '@/testing/services.js'

import { SubsStore } from './subs.js'

describe('subscriptions persistence', () => {
  let db: SubsStore

  beforeAll(() => {
    const mem = new Level()
    db = new SubsStore(_log, mem)
  })

  describe('prepare data', () => {
    it('should insert subscriptions', async () => {
      for (const sub of _subsFix) {
        await db.insert(sub)
      }
      expect((await db.getByAgentId(_testAgentId)).length).toBe(5)
    })
  })

  describe('modify subscriptions', () => {
    it('should prevent duplicate subscription ids under the same agent', async () => {
      await expect(async () => {
        await db.insert(_subsFix[0])
      }).rejects.toThrow()
    })

    it('should remove subsciption by id', async () => {
      const subs = await db.getByAgentId(_testAgentId)
      await db.remove(_testAgentId, subs[subs.length - 1].id)
      expect((await db.getByAgentId(_testAgentId)).length).toBe(subs.length - 1)
    })

    /* TODO: move to agents??
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
    */
  })
})
