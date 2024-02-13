import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import WebsocketProtocol from './protocol.js';

declare module 'fastify' {
  interface FastifyInstance {
    wsProtocol: WebsocketProtocol
  }
}

export type WebsocketProtocolOptions = {
  wsMaxClients: number
}

/**
 * Websocket subscription protocol plug-in.
 *
 * @param fastify The fastify instance
 */
const websocketProtocolPlugin: FastifyPluginAsync<WebsocketProtocolOptions>
= async (fastify, options) => {
  const { log, switchboard } = fastify;

  const protocol = new WebsocketProtocol(log, switchboard, options);

  fastify.decorate('wsProtocol', protocol);

  fastify.get('/ws/subs', { websocket: true },
    (connection, request) : void => {
      setImmediate(() => protocol.handle(connection, request));
    }
  );

  fastify.addHook('onClose', async () => {
    log.info('Shutting down websockets protocol');

    await protocol.stop();
  });
};

export default fp(websocketProtocolPlugin, { fastify: '>=4.x', name: 'ws-protocol' });
