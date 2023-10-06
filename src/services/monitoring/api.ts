import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { FinalizedHeadCollector, MessageCollector } from './collectors/index.js';
import { $QuerySubscription, QuerySubscription } from '../types.js';
import { $ChainHead } from './types.js';

/**
 * Subscriptions HTTP API.
 */
export function SubscriptionApi(
  fastify: FastifyInstance,
  {
    msgCollector,
    headCollector
  }:
  {
    msgCollector: MessageCollector,
    headCollector: FinalizedHeadCollector
  },
  done: (err?: Error) => void
) {
  fastify.get('/subs', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: zodToJsonSchema(
            $QuerySubscription
          )
        }
      }
    }
  }, async (_, reply) => {
    reply.send(await msgCollector.getSubscriptions());
  });

  fastify.get<{
    Params: {
      id: string
    }
  }>('/subs/:id', {
    schema: {
      params: {
        id: { type: 'string' }
      },
      response: {
        200: zodToJsonSchema(
          $QuerySubscription
        ),
        404: {
          type: 'null'
        }
      }
    }
  }, async (request, reply) => {
    const sub = await msgCollector.getSubscription(request.params.id);
    if (sub !== undefined) {
      reply.send(sub);
    } else {
      reply.status(404).send();
    }
  });

  fastify.post <{
    Body: QuerySubscription
  }>('/subs', {
    schema: {
      body: zodToJsonSchema(
        $QuerySubscription
      ),
      response: {
        201: {
          type: 'null',
          description: 'Accepted'
        }
      }
    }
  }, async (request, reply) => {
    await msgCollector.subscribe(request.body);

    reply.status(201).send();
  });

  fastify.delete<{
    Params: {
      id: string
    }
  }>('/subs/:id', {
    schema: {
      params: {
        id: { type: 'string' }
      },
      response: {
        200: {
          type: 'null',
          description: 'Accepted'
        }
      }
    }
  }, (request, reply) => {
    msgCollector.unsubscribe(request.params.id);

    reply.send();
  });

  fastify.get('/heads', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: zodToJsonSchema($ChainHead)
        }
      }
    }
  }, async (_,reply) => {
    reply.send(await headCollector.listHeads());
  });

  done();
}