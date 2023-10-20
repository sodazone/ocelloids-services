
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Level } from 'level';
import { MemoryLevel } from 'memory-level';

import { DB } from '../types.js';
import { environment } from '../../environment.js';
import { Janitor, JanitorOptions } from './janitor.js';
import { SubsDB } from './subs.js';

declare module 'fastify' {
  interface FastifyInstance {
    storage: {
      db: DB,
      subsDB: SubsDB
    }
    janitor: Janitor
  }
}

type DBOptions = JanitorOptions & {
  db: string;
}

/**
 * Storage plug-in.
 *
 * @param fastify
 * @param options
 */
const storagePlugin: FastifyPluginAsync<DBOptions>
= async (fastify, options) => {
  let db;

  /* istanbul ignore else  */
  if (environment === 'test') {
    db = new MemoryLevel();
  } else {
    const dbPath = options.db || './db';

    fastify.log.info(`Open database at ${dbPath}`);

    db = new Level(dbPath);
  }
  const subsDB = new SubsDB(fastify.log, db, fastify.config);
  const janitor = new Janitor(fastify.log, db, options);

  fastify.decorate('storage', {
    db,
    subsDB
  });
  fastify.decorate('janitor', janitor);

  fastify.addHook('onClose', (instance, done) => {
    janitor.stop().catch(error => {
      instance.log.error(error, 'Error while stopping the janitor');
    }).finally(() => {
      instance.storage.db.close(error => {
        instance.log.info('Closing database');
        /* istanbul ignore if */
        if (error) {
          instance.log.error(error, 'Error while closing the database');
        }
        done();
      });
    });
  });

  janitor.start();
};

export default fp(storagePlugin, { fastify: '>=4.x', name: 'storage' });

