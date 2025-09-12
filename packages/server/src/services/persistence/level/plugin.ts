import path from 'node:path'

import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { DatabaseOptions, Level } from 'level'
import { MemoryLevel } from 'memory-level'

import { DatabaseOptions as DatabaseServiceOptions, LevelServerOptions } from '@/types.js'
import { LevelDB, LevelEngine, OpenLevelDB } from '../../types.js'
import { SubsStore } from './subs.js'

declare module 'fastify' {
  interface FastifyInstance {
    levelDB: LevelDB<string, any>
    subsStore: SubsStore
    openLevelDB: OpenLevelDB
  }
}

type LevelServiceOptions = DatabaseServiceOptions & LevelServerOptions

function createLevelDB<K = any, V = any>(
  { log }: FastifyInstance,
  name: string,
  { data, levelEngine }: LevelServiceOptions,
  options?: DatabaseOptions<K, V>,
): LevelDB<K, V> {
  const dbPath = path.join(data || './.db', name)

  log.info('[level] engine %s', levelEngine)
  log.info('[level] open database at %s', dbPath)

  switch (levelEngine) {
    case LevelEngine.mem:
      return new MemoryLevel(options) as LevelDB<K, V>
    default:
      return new Level(dbPath, options) as LevelDB<K, V>
  }
}

const levelDBPlugin: FastifyPluginAsync<LevelServiceOptions> = async (fastify, serviceOpts) => {
  const dbs = new Map<string, LevelDB<any, any>>()

  const root = createLevelDB(fastify, 'level', serviceOpts)
  await root.open()
  dbs.set('level', root)

  fastify.decorate('levelDB', root)
  fastify.decorate('subsStore', new SubsStore(fastify.log, root))

  fastify.decorate('openLevelDB', <K, V>(name: string, options?: DatabaseOptions<K, V>): LevelDB<K, V> => {
    if (!dbs.has(name)) {
      const db = createLevelDB(fastify, name, serviceOpts, options)
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
