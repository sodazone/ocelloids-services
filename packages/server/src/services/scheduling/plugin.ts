import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { Janitor, JanitorOptions } from './janitor.js'
import { Scheduler, SchedulerOptions } from './scheduler.js'

declare module 'fastify' {
  interface FastifyInstance {
    scheduler: Scheduler
    janitor: Janitor
  }
}

type SchedulingOptions = JanitorOptions & SchedulerOptions

/**
 * Scheduling related services.
 *
 * @param fastify - The Fastify instance
 * @param options - The scheduling options
 */
const schedulingPlugin: FastifyPluginAsync<SchedulingOptions> = async (fastify, options) => {
  const scheduler = new Scheduler(fastify.log, fastify.levelDB, options)
  const janitor = new Janitor(fastify.log, fastify.levelDB, scheduler, options)

  fastify.decorate('janitor', janitor)
  fastify.decorate('scheduler', scheduler)

  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('[scheduler] plugin stop')

    try {
      await scheduler.stop()
    } catch (error) {
      instance.log.error(error, '[scheduler] error while stopping the scheduler')
    }
  })

  fastify.after((error) => {
    if (error === null) {
      scheduler.start()
    }
  })
}

export default fp(schedulingPlugin, { fastify: '>=4.x', name: 'scheduling', dependencies: ['leveldb'] })
