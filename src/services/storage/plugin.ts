import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Level } from 'level';
import { MemoryLevel } from 'memory-level';

import { DB } from '../types.js';
import { environment } from '../../environment.js';
import { Janitor, JanitorOptions } from './janitor.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB,
    janitor: Janitor
  }
}

type DBOptions = JanitorOptions & {
  db: string;
}

/**
 * Abstract Level DB plug-in.
 *
 * @param fastify
 * @param options
 */
const levelPluginCallback: FastifyPluginAsync<DBOptions> = async (fastify, options) => {
  let db;

  if (environment === 'test') {
    db = new MemoryLevel();
  } else {
    const dbPath = options.db || './db';

    fastify.log.info(`Open database at ${dbPath}`);

    db = new Level(dbPath);
  }

  const janitor = new Janitor(fastify.log, db, options);

  fastify.decorate('db', db);
  fastify.decorate('janitor', janitor);

  fastify.addHook('onClose', (instance, done) => {
    janitor.stop();

    instance.db.close((err) => {
      if (err) {
        instance.log.error('Error while closing the database', err);
      }
      done();
    });
  });

  janitor.start();
};

export default fp(levelPluginCallback, { fastify: '>=4.x', name: 'level' });

