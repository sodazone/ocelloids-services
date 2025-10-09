import { DuckDBInstance } from '@duckdb/node-api'
import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { AnalyticsOptions, DatabaseOptions } from '@/types.js'
import { resolveDataPath } from '../persistence/util.js'

declare module 'fastify' {
  interface FastifyInstance {
    analyticsDB?: DuckDBInstance
  }
}

export interface DuckDBOptions {
  filename: string
  configuration?: Record<string, string>
}

type AnalyticsPluginOptions = DatabaseOptions & AnalyticsOptions

const analyticsPlugin: FastifyPluginAsync<AnalyticsPluginOptions> = async (fastify, { data, analytics }) => {
  if (analytics === false) {
    return
  }

  const filename = resolveDataPath('analytics.duckdb', data)

  fastify.log.info('[analytics] database at %s', filename)

  const instance = await DuckDBInstance.create(filename, {
    max_memory: '1GB',
    wal_autocheckpoint: '5MB',
    TimeZone: 'UTC',
  })

  fastify.decorate('analyticsDB', instance)

  fastify.addHook('onClose', () => {
    fastify.log.info('[analytics] closing database')

    instance.closeSync()
  })
}

export default fp(analyticsPlugin, { fastify: '>=4.x', name: 'analytics' })
