import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Operation, applyPatch } from 'rfc6902';

import { MessageCollector } from '../collectors/index.js';
import { $QuerySubscription, $SafeId, QuerySubscription } from '../types.js';
import $JSONPatch from './json-patch.js';

const allowedPaths = [
  '/senders', '/destinations', '/notify'
];

function hasOp(patch: Operation[], path: string) {
  return patch.some(op => op.path.startsWith(path));
}

/**
 * Subscriptions HTTP API.
 */
export function SubscriptionApi(
  fastify: FastifyInstance,
  {
    msgCollector
  }:
  {
    msgCollector: MessageCollector
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
        400: { type: 'string' },
        404: { type: 'string' }
      }
    }
  }, async (request, reply) => {
    const patch = request.body;
    const { id } = request.params;
    const sub = await msgCollector.getSubscription(id);

    // Check allowed patch ops
    const allowedOps = patch.every(op => allowedPaths
      .some(s => op.path.startsWith(s))
    );

    if (allowedOps) {
      applyPatch(sub, patch);
      $QuerySubscription.parse(sub);

      if (hasOp(patch, '/senders')) {
        msgCollector.updateSenders(id, sub.senders);
      }

      if (hasOp(patch, '/destinations')) {
        msgCollector.updateDestinations(id, sub.destinations);
      }

      await msgCollector.updateInDB(sub);

      reply.status(200).send(sub);
    } else {
      reply.status(400).send(
        'Only operations on these paths are allowed: ' + allowedPaths.join(',')
      );
    }
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

  done();
}