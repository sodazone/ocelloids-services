import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Level } from 'level';
import { MemoryLevel } from 'memory-level';

import { DB } from '../types.js';
import { environment } from '../../environment.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
  }
}

type DBOptions = {
  db: string;
}

/**
 * Abstract Level DB plug-in.
 *
 * @param fastify
 * @param options
 */
const levelPluginCallback: FastifyPluginAsync<DBOptions> = async (fastify, options) => {
  let level;

  if (environment === 'test') {
    level = new MemoryLevel();
  } else {
    const dbPath = options.db || './db';

    fastify.log.info(`Open database at ${dbPath}`);

    level = new Level(dbPath);
  }

  fastify.decorate('db', level);

  fastify.addHook('onClose', (instance, done) => {
    instance.db.close((err) => {
      if (err) {
        instance.log.error('Error while closing the database', err);
      }
      done();
    });
  });
};

export default fp(levelPluginCallback, { fastify: '>=4.x', name: 'level' });

