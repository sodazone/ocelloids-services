import process from 'node:process';

import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import FastifySwagger from '@fastify/swagger';
import FastifySwaggerUI from '@fastify/swagger-ui';
import FastifyHealthcheck from 'fastify-healthcheck';

import version from './version.js';
import { ServerOptions } from './types.js';
import {
  Root, Configuration, Monitoring, Matching
} from './services/index.js';

const environment = process.env.NODE_ENV || 'development';

const envToLogger: Record<string, any> = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

const ServerDefauls = {
  delay: (process.env.FASTIFY_CLOSE_GRACE_DELAY ?? 500) as number,
  port: (process.env.PORT ?? 3000) as number,
  logger: envToLogger[environment]
};

export function createServer(
  opts: ServerOptions
) {
  const server = Fastify({
    logger: ServerDefauls.logger
  });

  server.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'XCM Monitoring Service',
        version: version()
      }
    }
  });

  server.register(FastifySwaggerUI, {
    routePrefix: '/documentation'
  });

  server.register(FastifyHealthcheck, {
    exposeUptime: true
  });

  server.register(Root);
  server.register(Configuration, opts);
  server.register(Matching, opts);
  server.register(Monitoring);

  const closeListeners = closeWithGrace({
    delay: ServerDefauls.delay
  }, async function ({ err }) {
    if (err) {
      server.log.error(err);
    }
    await server.close();
  });

  process.once('SIGUSR2', async function () {
    await server.close();
  });

  server.addHook('onClose', function (_instance, done) {
    closeListeners.uninstall();
    done();
  });

  server.listen({
    port: ServerDefauls.port
  }, function (err, _address) {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
}
