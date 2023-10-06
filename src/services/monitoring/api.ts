import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Operation, applyPatch } from 'rfc6902';

import { FinalizedHeadCollector, MessageCollector } from './collectors/index.js';
import { $ChainHead, $QuerySubscription, $SafeId, QuerySubscription } from './types.js';
import $JSONPatch from './json-patch.js';

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
        id: zodToJsonSchema($SafeId)
      },
      response: {
        200: zodToJsonSchema($QuerySubscription),
        404: { type: 'string' }
      }
    }
  }, async (request, reply) => {
    reply.send(await msgCollector.getSubscription(
      request.params.id
    ));
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

  fastify.patch <{
    Params: {
      id: string
    },
    Body: Operation[]
  }>('/subs/:id', {
    schema: {
      params: {
        id: zodToJsonSchema($SafeId)
      },
      body: $JSONPatch,
      response: {
        200: zodToJsonSchema($QuerySubscription),
        404: { type: 'string' }
      }
    }
  }, async (request, reply) => {
    const sub = await msgCollector.getSubscription(request.params.id);
    applyPatch(sub, request.body);
    $QuerySubscription.parse(sub);
    //await msgCollector.subscribe(request.body);
    reply.status(200).send(sub);
  });

  fastify.delete<{
    Params: {
      id: string
    }
  }>('/subs/:id', {
    schema: {
      params: {
        id: zodToJsonSchema($SafeId)
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
  }, async (_, reply) => {
    reply.send(await headCollector.listHeads());
  });

  done();
}