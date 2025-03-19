import { DuckDBInstance } from '@duckdb/node-api'

import { AnalyticsOptions, DatabaseOptions } from '@/types.js'
import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
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

  const instance = await DuckDBInstance.create(filename /** config? */)

  fastify.decorate('analyticsDB', instance)
}

export default fp(analyticsPlugin, { fastify: '>=4.x', name: 'analytics' })
