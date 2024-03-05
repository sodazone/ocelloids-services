import process from 'node:process';

import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import FastifySwagger from '@fastify/swagger';
import FastifySwaggerUI from '@fastify/swagger-ui';
import FastifyWebsocket from '@fastify/websocket';
import FastifyCors from '@fastify/cors';
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
  Connector,
} from './services/index.js';
import { toCorsOpts } from './args.js';

const WS_MAX_PAYLOAD = 1048576; // 1MB

/**
 * Creates and starts the server process with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export async function createServer(opts: ServerOptions) {
  const server = Fastify({
    logger,
  });

  server.setErrorHandler(errorHandler);

  /* istanbul ignore next */
  const closeListeners = closeWithGrace(
    {
      delay: opts.grace,
    },
    async function ({ err }) {
      if (err) {
        server.log.error(err);
      }

      const { websocketServer } = server;
      if (websocketServer.clients) {
        server.log.info('Closing websockets');

        for (const client of websocketServer.clients) {
          client.close(1001, 'server shutdown');
          if (client.readyState !== client.CLOSED) {
            // Websocket clients could ignore the close acknowledge
            // breaking the clean shutdown of the server.
            // To prevent it we terminate the socket.
            client.terminate();
          }
        }
      }

      await server.close();
    }
  );

  /* istanbul ignore next */
  process.once('SIGUSR2', async function () {
    await server.close();
    // Controlled shutdown for Nodemon
    // https://github.com/remy/nodemon?tab=readme-ov-file#controlling-shutdown-of-your-script
    process.kill(process.pid, 'SIGUSR2');
  });

  server.addHook('onClose', function (_, done) {
    closeListeners.uninstall();
    done();
  });

  await server.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'XCM Monitoring Service',
        version,
      },
    },
  });

  await server.register(FastifySwaggerUI, {
    routePrefix: '/documentation',
  });

  await server.register(FastifyHealthcheck, {
    exposeUptime: true,
  });

  await server.register(FastifyWebsocket, {
    options: {
      // we don't need to negotiate subprotocols
      handleProtocols: undefined,
      maxPayload: WS_MAX_PAYLOAD,
      perMessageDeflate: false,
      // https://elixir.bootlin.com/linux/v4.15.18/source/Documentation/networking/ip-sysctl.txt#L372
      // backlog: 511 // # default
    },
    // override default pre-close
    // we explicitly handle it with terminate
    preClose: () => {},
  });

  if (opts.cors) {
    server.log.info('Enable CORS');

    const corsOpts = toCorsOpts(opts);
    server.log.info('- origin: %s', corsOpts.origin);
    server.log.info('- credentials: %s', corsOpts.credentials);

    await server.register(FastifyCors, corsOpts);
  }

  await server.register(Root);
  await server.register(Auth);
  await server.register(Configuration, opts);
  await server.register(Persistence, opts);
  await server.register(Connector);
  await server.register(Monitoring, opts);
  await server.register(Administration);
  await server.register(Telemetry, opts);

  return server;
}
