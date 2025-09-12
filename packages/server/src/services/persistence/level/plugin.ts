import path from 'node:path'

import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { Level } from 'level'
import { MemoryLevel } from 'memory-level'

import { DatabaseOptions, LevelServerOptions } from '@/types.js'
import { LevelDB, LevelEngine } from '../../types.js'
import { SubsStore } from './subs.js'

declare module 'fastify' {
  interface FastifyInstance {
    levelDB: LevelDB
    subsStore: SubsStore
    openLevelDB: (name?: string) => LevelDB
  }
}

type LevelOptions = DatabaseOptions & LevelServerOptions

function createLevelDB({ log }: FastifyInstance, name: string, { data, levelEngine }: LevelOptions): LevelDB {
  const dbPath = path.join(data || './.db', name)

  log.info('[level] engine %s', levelEngine)
  log.info('[level] open database at %s', dbPath)

  switch (levelEngine) {
    case LevelEngine.mem:
      return new MemoryLevel() as LevelDB
    default:
      return new Level(dbPath) as LevelDB
  }
}

const levelDBPlugin: FastifyPluginAsync<LevelOptions> = async (fastify, options) => {
  const dbs = new Map<string, LevelDB>()

  const root = createLevelDB(fastify, 'level', options)
  await root.open()
  dbs.set('level', root)

  fastify.decorate('levelDB', root)
  fastify.decorate('subsStore', new SubsStore(fastify.log, root))

  fastify.decorate('openLevelDB', (name: string = 'level') => {
    if (!dbs.has(name)) {
      const db = createLevelDB(fastify, name, options)
      db.open()
      dbs.set(name, db)
    }
    return dbs.get(name)!
  })

  fastify.addHook('onClose', async () => {
    fastify.log.info('[scheduler] plugin stop')
    for (const [name, db] of dbs) {
      if (db.status === 'open') {
        fastify.log.info('[level] closing database %s: OK', name)
        await db.close()
      } else {
        fastify.log.info('[level] database %s is not open: %s', name, db.status)
      }
    }
  })
}

export default fp(levelDBPlugin, { fastify: '>=4.x', name: 'leveldb' })
