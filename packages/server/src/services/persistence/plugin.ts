import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Level } from 'level';

import { DB } from '../types.js';
import { Janitor, JanitorOptions } from './janitor.js';
import { Scheduler, SchedulerOptions } from './scheduler.js';

declare module 'fastify' {
  interface FastifyInstance {
    rootStore: DB;
    scheduler: Scheduler;
    janitor: Janitor;
  }
}

type DBOptions = JanitorOptions &
  SchedulerOptions & {
    db: string;
  };

/**
 * Persistence related services.
 *
 * @param fastify - The fastify instance
 * @param options - The persistence options
 */
const persistencePlugin: FastifyPluginAsync<DBOptions> = async (fastify, options) => {
  const dbPath = options.db || './db';

  fastify.log.info(`Open database at ${dbPath}`);

  const root = new Level(dbPath);
  const scheduler = new Scheduler(fastify.log, root, options);
  const janitor = new Janitor(fastify.log, root, scheduler, options);

  fastify.decorate('rootStore', root);
  fastify.decorate('janitor', janitor);
  fastify.decorate('scheduler', scheduler);

  fastify.addHook('onClose', (instance, done) => {
    scheduler
      .stop()
      .catch((error) => {
        instance.log.error(error, 'Error while stopping the scheduler');
      })
      .finally(() => {
        instance.rootStore.close((error) => {
          instance.log.info('Closing database');
          /* istanbul ignore if */
          if (error) {
            instance.log.error(error, 'Error while closing the database');
          }
          done();
        });
      });
  });

  try {
    await root.open();
  } catch (err) {
    fastify.log.error(err, 'Error opening database');
    throw err;
  }

  scheduler.start();
};

export default fp(persistencePlugin, { fastify: '>=4.x', name: 'persistence' });
