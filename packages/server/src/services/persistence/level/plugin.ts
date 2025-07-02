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
  }
}

type LevelOptions = DatabaseOptions & LevelServerOptions

function createLevelDB({ log }: FastifyInstance, { data, levelEngine }: LevelOptions): LevelDB {
  const dbPath = path.join(data || './.db', 'level')

  log.info('[level] engine %s', levelEngine)
  log.info('[level] open database at %s', dbPath)

  switch (levelEngine) {
    case LevelEngine.mem:
      return new MemoryLevel() as LevelDB
    default:
      return new Level(dbPath) as LevelDB
  }
}

/**
 * LevelDB related services.
 *
 * @param fastify - The Fastify instance
 * @param options - The persistence options
 */
const levelDBPlugin: FastifyPluginAsync<LevelOptions> = async (fastify, options) => {
  const root = createLevelDB(fastify, options)
  const subsStore = new SubsStore(fastify.log, root)

  fastify.decorate('levelDB', root)
  fastify.decorate('subsStore', subsStore)

  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('[scheduler] plugin stop')

    const { levelDB } = instance
    if (levelDB.status === 'open') {
      instance.log.info('[level] closing database: OK')
      await levelDB.close()
    } else {
      instance.log.info('[level] the database is not open: %s', levelDB.status)
    }
  })

  try {
    await root.open()
  } catch (err) {
    fastify.log.error(err, '[level] error opening database')
    throw err
  }
}

export default fp(levelDBPlugin, { fastify: '>=4.x', name: 'leveldb' })
