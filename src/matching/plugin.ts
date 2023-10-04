import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Level } from 'level';
import { MatchingEngine } from './engine.js';
import { DB, ServerOptions } from '../types.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine: MatchingEngine;
    db: DB
  }
}

const levelPluginCallback: FastifyPluginAsync<ServerOptions> = async (fastify, options) => {
  const dbPath = options.db || './db';

  fastify.log.info(`Open database at ${dbPath}`);

  const level = new Level(dbPath);
  const engine = new MatchingEngine(level, fastify.log);

  fastify.decorate('engine', engine);
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

