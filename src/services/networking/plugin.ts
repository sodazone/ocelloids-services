import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import Connector from './connector.js';

declare module 'fastify' {
  interface FastifyInstance {
    connector: Connector
  }
}

const connectorPlugin: FastifyPluginAsync = async fastify => {
  const connector = new Connector(fastify.log, fastify.config);
  fastify.decorate('connector', connector);

  fastify.addHook('onClose', (_, done) => {
    connector.disconnect().then(() => done());
  });
};

export default fp(connectorPlugin, { fastify: '>=4.x', name: 'connector' });
