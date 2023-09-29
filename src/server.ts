import process from 'node:process';
import 'dotenv/config';

import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import matching from './matching/plugin.js';
import monitoring from './monitoring-service.js';

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

const server = Fastify({
  logger: ServerDefauls.logger
});

// Register services
server.register(matching);
server.register(monitoring);

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