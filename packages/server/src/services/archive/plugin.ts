import { DatabaseOptions } from '@/types.js'
import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { resolveDataPath } from '../persistence/kysely/db.js'
import { createArchiveDatabase } from './db.js'
import { ArchiveRepository } from './repository.js'

declare module 'fastify' {
  interface FastifyInstance {
    archive: ArchiveRepository
  }
}

const archivePlugin: FastifyPluginAsync<DatabaseOptions> = async (fastify, { data }) => {
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
}

export default fp(archivePlugin, { fastify: '>=4.x', name: 'archive' })
