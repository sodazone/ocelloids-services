import process from 'node:process';

import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import FastifySwagger from '@fastify/swagger';
import FastifySwaggerUI from '@fastify/swagger-ui';
import FastifyHealthcheck from 'fastify-healthcheck';

import version from './version.js';
import { logger } from './environment.js';
import { ServerOptions } from './types.js';
import {
  Root,
  Storage,
  Configuration,
  Monitoring,
  Matching
} from './services/index.js';
import { NotFound } from './errors.js';
import { ZodError } from 'zod';

/**
 * Creates and starts the server process with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export async function createServer(
  opts: ServerOptions
) {
  const server = Fastify({
    logger
  });

  server.setErrorHandler(function (error, _, reply) {
    if (error instanceof NotFound) {
      reply.status(404).send(error.message);
    } else if (error instanceof ZodError) {
      reply.status(400).send(error.message);
    } else {
      // to parent handler
      reply.send(error);
    }
  });

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

  await server.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'XCM Monitoring Service',
        version
      }
    }
  });

  await server.register(FastifySwaggerUI, {
    routePrefix: '/documentation'
  });

  await server.register(FastifyHealthcheck, {
    exposeUptime: true
  });

  await server.register(Root);
  await server.register(Storage, opts);
  await server.register(Configuration, opts);
  await server.register(Matching);
  await server.register(Monitoring);

  return server;
}
