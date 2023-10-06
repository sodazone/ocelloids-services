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
import { NotFound } from './errors.js';

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

/**
 * Creates and starts the server process with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export function createServer(
  opts: ServerOptions
) {
  const server = Fastify({
    logger: envToLogger[environment]
  });

  server.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'XCM Monitoring Service',
        version
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
    delay: opts.grace
  }, async function ({ err }) {
    if (err) {
      server.log.error(err);
    }
    await server.close();
  });

  process.once('SIGUSR2', async function () {
    await server.close();
  });

  server.addHook('onClose', function (_, done) {
    closeListeners.uninstall();
    done();
  });

  server.setErrorHandler(function (error, _, reply) {
    if (error instanceof NotFound) {
      reply.status(404).send(error.message);
    } else {
      // to parent handler
      reply.send(error);
    }
  });

  server.listen({
    port: opts.port,
    host: opts.host
  }, function (err, _) {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
}
