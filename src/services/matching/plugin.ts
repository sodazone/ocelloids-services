import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { MatchingEngine } from './engine.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine: MatchingEngine;
  }
}

const matchingEnginePluginCallback: FastifyPluginAsync = async (fastify) => {
  const engine = new MatchingEngine(fastify.db, fastify.log);

  fastify.decorate('engine', engine);
};

export default fp(matchingEnginePluginCallback, { fastify: '>=4.x', name: 'matching-engine' });

