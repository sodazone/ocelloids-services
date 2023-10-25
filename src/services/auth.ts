import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

import { environment } from '../environment.js';

declare module 'fastify' {
  interface FastifyInstance {
    auth: (
      request: FastifyRequest, reply: FastifyReply
    ) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync
= async fastify =>  {
  if (environment !== 'development' && !process.env.XCMON_SECRET) {
    fastify.log.warn('!! Default XCMON_SECRET configured !!');
  }

  fastify.register(jwt, {
    secret: process.env.XCMON_SECRET || 'IAOAbraxasSabaoth'
  });
  fastify.decorate('auth',
    async function (
      request: FastifyRequest, reply: FastifyReply
    ) : Promise<void> {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send(err);
      }
    }
  );
};

export default fp(authPlugin);

