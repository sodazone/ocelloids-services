import { ArchiveOptions, DatabaseOptions } from '@/types.js'
import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { resolveDataPath } from '../persistence/kysely/db.js'
import { createArchiveDatabase } from './db.js'
import { ArchiveRepository } from './repository.js'
import { ArchiveRetentionJob } from './retention.js'

declare module 'fastify' {
  interface FastifyInstance {
    archive?: ArchiveRepository
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

  fastify.addHook('onClose', () => {
    fastify.log.info('[archive] closing logs database')
    return db.destroy()
  })

  await migrator.migrateToLatest()

  if (archiveRetention) {
    const retentionJob = new ArchiveRetentionJob(fastify.log, archiveRepository, {
      period: archiveRetentionPeriod,
      tickMillis: archiveTick,
    })
    fastify.addHook('onClose', () => {
      return retentionJob.stop()
    })
    await retentionJob.start()
  } else {
    fastify.log.info('[archive] retention job is not enabled')
  }
}

export default fp(archivePlugin, { fastify: '>=4.x', name: 'archive' })
