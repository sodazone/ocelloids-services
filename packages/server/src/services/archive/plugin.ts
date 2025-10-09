import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { ArchiveOptions, DatabaseOptions } from '@/types.js'
import { resolveDataPath } from '../persistence/util.js'
import { createArchiveDatabase } from './db.js'
import { ArchiveRepository } from './repository.js'
import { ArchiveRetentionOptions } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    archive?: ArchiveRepository
    archiveRetentionOpts?: ArchiveRetentionOptions
  }
}

type ArchivePluginOptions = DatabaseOptions & ArchiveOptions

const archivePlugin: FastifyPluginAsync<ArchivePluginOptions> = async (
  fastify,
  { data, archive, archiveRetention, archiveRetentionPeriod, archiveTick },
) => {
  if (archive === false) {
    return
  }

  const filename = resolveDataPath('db.arc.sqlite', data)

  fastify.log.info('[archive] logs database at %s', filename)

  const { db, migrator } = createArchiveDatabase(filename)
  const archiveRepository = new ArchiveRepository(db)

  fastify.decorate('archive', archiveRepository)
  fastify.decorate('archiveRetention', {
    enabled: archiveRetention,
    policy: {
      period: archiveRetentionPeriod,
      tickMillis: archiveTick,
    },
  } as ArchiveRetentionOptions)

  fastify.log.info(
    '[archive] retention enabled=%s, period=%s, tick=%s',
    archiveRetention,
    archiveRetentionPeriod,
    archiveTick,
  )

  fastify.addHook('onClose', () => {
    fastify.log.info('[archive] closing logs database')

    return db.destroy()
  })

  await migrator.migrateToLatest()
}

export default fp(archivePlugin, { fastify: '>=4.x', name: 'archive' })
