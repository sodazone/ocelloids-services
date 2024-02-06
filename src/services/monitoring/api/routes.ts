import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Operation, applyPatch } from 'rfc6902';

import { wsSubscriptionHandler } from './ws/protocol.js';
import { Switchboard } from '../switchboard.js';
import { $QuerySubscription, $SafeId, QuerySubscription } from '../types.js';
import $JSONPatch from './json-patch.js';

const allowedPaths = [
  '/senders', '/destinations', '/channels'
];

function hasOp(patch: Operation[], path: string) {
  return patch.some(op => op.path.startsWith(path));
}

/**
 * Subscriptions HTTP API.
 */
export function SubscriptionApi(
  api: FastifyInstance,
  {
    switchboard
  }:
  {
    switchboard: Switchboard
  },
  done: (err?: Error) => void
) {
  const { log, storage: { subs } } = api;

  /**
   * GET subs
   */
  api.get('/subs', {
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
    reply.send(await subs.getAll());
  });

  /**
   * GET subs/:id
   */
  api.get<{
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
    reply.send(await subs.getById(
      request.params.id
    ));
  });

  /**
   * POST subs
   */
  api.post <{
    Body: QuerySubscription | QuerySubscription[]
  }>('/subs', {
    schema: {
      body: {
        oneOf: [
          zodToJsonSchema(
            $QuerySubscription
          ),
          {
            type: 'array',
            items: zodToJsonSchema(
              $QuerySubscription
            )
          }
        ]
      },
      response: {
        201: {
          type: 'null',
          description: 'Accepted'
        }
      }
    }
  }, async (request, reply) => {
    const qs = request.body;
    if (Array.isArray(qs)) {
      const ids = [];
      try {
        for (const q of qs) {
          await switchboard.subscribe(q);
          ids.push(q.id);
        }
      } catch (error) {
        for (const id of ids) {
          await switchboard.unsubscribe(id);
        }
        throw error;
      }
    } else {
      await switchboard.subscribe(qs);
    }

    reply.status(201).send();
  });

  /**
   * PATCH subs/:id
   */
  api.patch <{
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
    const sub = await subs.getById(id);

    // Check allowed patch ops
    const allowedOps = patch.every(op => allowedPaths
      .some(s => op.path.startsWith(s))
    );

    if (allowedOps) {
      applyPatch(sub, patch);
      $QuerySubscription.parse(sub);

      await subs.save(sub);

      await switchboard.updateSubscription(sub);

      if (hasOp(patch, '/senders')) {
        switchboard.updateSenders(id);
      }

      if (hasOp(patch, '/destinations')) {
        switchboard.updateDestinations(id);
      }

      reply.status(200).send(sub);
    } else {
      reply.status(400).send(
        'Only operations on these paths are allowed: ' + allowedPaths.join(',')
      );
    }
  });

  /**
   * DELETE subs/:id
   */
  api.delete<{
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
  }, async (request, reply) => {
    await switchboard.unsubscribe(request.params.id);

    reply.send();
  });

  /**
   * GET ws/subs
   */
  api.get('/ws/subs', { websocket: true },
    async (connection, _request) => {
      await wsSubscriptionHandler(log, switchboard, connection);
    }
  );

  done();
}