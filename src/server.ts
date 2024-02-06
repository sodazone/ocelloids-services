import process from 'node:process';

import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import FastifySwagger from '@fastify/swagger';
import FastifySwaggerUI from '@fastify/swagger-ui';
import FastifyWebsocket from '@fastify/websocket';
import FastifyHealthcheck from 'fastify-healthcheck';

import version from './version.js';
import { errorHandler } from './errors.js';
import { logger } from './environment.js';
import { ServerOptions } from './types.js';
import {
  Root,
  Auth,
  Telemetry,
  Administration,
  Persistence,
  Configuration,
  Monitoring,
  Connector
} from './services/index.js';

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

  server.setErrorHandler(errorHandler);

  /* istanbul ignore next */
  const closeListeners = closeWithGrace({
    delay: opts.grace
  }, async function ({ err }) {
    if (err) {
      server.log.error(err);
    }
    await server.close();
  });

  /* istanbul ignore next */
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

  await server.register(FastifyWebsocket, {
    options: { maxPayload: 1048576 }
  });

  await server.register(Root);
  await server.register(Auth);
  await server.register(Configuration, opts);
  await server.register(Persistence, opts);
  await server.register(Connector);
  await server.register(Monitoring);
  await server.register(Administration);
  await server.register(Telemetry, opts);

  return server;
}
