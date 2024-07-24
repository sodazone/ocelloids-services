import path from 'node:path'

import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { Level } from 'level'
import { MemoryLevel } from 'memory-level'
import { RaveLevel } from 'rave-level'

import { DatabaseOptions, LevelServerOptions } from '@/types.js'
import { LevelDB, LevelEngine } from '../../types.js'
import { Janitor, JanitorOptions } from './janitor.js'
import { Scheduler, SchedulerOptions } from './scheduler.js'
import { SubsStore } from './subs.js'

declare module 'fastify' {
  interface FastifyInstance {
    levelDB: LevelDB
    subsStore: SubsStore
    scheduler: Scheduler
    janitor: Janitor
  }
}

type LevelOptions = JanitorOptions & SchedulerOptions & DatabaseOptions & LevelServerOptions

function createLevel({ log }: FastifyInstance, { data, levelEngine }: LevelOptions): Level {
  const dbPath = path.join(data || './.db', 'level')

  log.info('[level] engine %s', levelEngine)
  log.info('[level] open database at %s', dbPath)

  switch (levelEngine) {
    case LevelEngine.mem:
      return new MemoryLevel() as Level
    case LevelEngine.rave:
      return new RaveLevel(dbPath) as Level
    default:
      return new Level(dbPath)
  }
}

/**
 * LevelDB related services.
 *
 * @param fastify - The Fastify instance
 * @param options - The persistence options
 */
const levelDBPlugin: FastifyPluginAsync<LevelOptions> = async (fastify, options) => {
  const root = createLevel(fastify, options)
  const scheduler = new Scheduler(fastify.log, root, options)
  const janitor = new Janitor(fastify.log, root, scheduler, options)
  const subsStore = new SubsStore(fastify.log, root)

  fastify.decorate('levelDB', root)
  fastify.decorate('janitor', janitor)
  fastify.decorate('scheduler', scheduler)
  fastify.decorate('subsStore', subsStore)

  fastify.addHook('onClose', function onClose(instance, done) {
    scheduler
      .stop()
      .catch((error) => {
        instance.log.error(error, '[level] error while stopping the scheduler')
      })
      .finally(() => {
        instance.levelDB.close((error) => {
          instance.log.info('[level] closing database: OK')
          /* istanbul ignore if */
          if (error) {
            instance.log.error(error, '[level] error while closing the database')
          }
          done()
        })
      })
  })

  try {
    await root.open()
  } catch (err) {
    fastify.log.error(err, '[level] error opening database')
    throw err
  }

  scheduler.start()
}

export default fp(levelDBPlugin, { fastify: '>=4.x', name: 'leveldb' })
