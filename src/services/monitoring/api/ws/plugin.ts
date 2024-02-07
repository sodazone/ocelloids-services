import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import WebsocketProtocol from './protocol.js';

declare module 'fastify' {
  interface FastifyInstance {
    wsProtocol: WebsocketProtocol
  }
}

/**
 * Websocket subscription protocol plug-in.
 *
 * @param fastify The fastify instance
 */
const websocketProtocolPlugin: FastifyPluginAsync = async fastify => {
  const { log, switchboard } = fastify;
  const protocol = new WebsocketProtocol(log, switchboard);

  fastify.decorate('wsProtocol', protocol);

  fastify.get('/ws/subs', { websocket: true },
    async (connection, request) => {
      await protocol.handle(connection, request);
    }
  );
};

export default fp(websocketProtocolPlugin, { fastify: '>=4.x', name: 'ws-protocol' });
