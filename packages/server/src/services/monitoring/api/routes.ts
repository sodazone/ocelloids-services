import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Operation, applyPatch } from 'rfc6902';

import { $Subscription, $SafeId, Subscription } from '../types.js';
import $JSONPatch from './json-patch.js';

const allowedPaths = ['/senders', '/destinations', '/channels', '/events'];

function hasOp(patch: Operation[], path: string) {
  return patch.some((op) => op.path.startsWith(path));
}

/**
 * Subscriptions HTTP API.
 */
export async function SubscriptionApi(api: FastifyInstance) {
  const { switchboard, subsStore } = api;

  /**
   * GET subs
   */
  api.get(
    '/subs',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: zodToJsonSchema($Subscription),
          },
        },
      },
    },
    async (_, reply) => {
      reply.send(await subsStore.getAll());
    }
  );

  /**
   * GET subs/:id
   */
  api.get<{
    Params: {
      id: string;
    };
  }>(
    '/subs/:id',
    {
      schema: {
        params: {
          id: zodToJsonSchema($SafeId),
        },
        response: {
          200: zodToJsonSchema($Subscription),
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      reply.send(await subsStore.getById(request.params.id));
    }
  );

  /**
   * POST subs
   */
  api.post<{
    Body: Subscription | Subscription[];
  }>(
    '/subs',
    {
      schema: {
        body: {
          oneOf: [
            zodToJsonSchema($Subscription),
            {
              type: 'array',
              items: zodToJsonSchema($Subscription),
            },
          ],
        },
        response: {
          201: {
            type: 'null',
            description: 'Accepted',
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  /**
   * PATCH subs/:id
   */
  api.patch<{
    Params: {
      id: string;
    };
    Body: Operation[];
  }>(
    '/subs/:id',
    {
      schema: {
        params: {
          id: zodToJsonSchema($SafeId),
        },
        body: $JSONPatch,
        response: {
          200: zodToJsonSchema($Subscription),
          400: { type: 'string' },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const patch = request.body;
      const { id } = request.params;
      const sub = await subsStore.getById(id);

      // Check allowed patch ops
      const allowedOps = patch.every((op) => allowedPaths.some((s) => op.path.startsWith(s)));

      if (allowedOps) {
        applyPatch(sub, patch);
        $Subscription.parse(sub);

        await subsStore.save(sub);

        switchboard.updateSubscription(sub);

        if (hasOp(patch, '/senders')) {
          switchboard.updateSenders(id);
        }

        if (hasOp(patch, '/destinations')) {
          switchboard.updateDestinations(id);
        }

        if (hasOp(patch, '/events')) {
          switchboard.updateEvents(id);
        }

        reply.status(200).send(sub);
      } else {
        reply.status(400).send('Only operations on these paths are allowed: ' + allowedPaths.join(','));
      }
    }
  );

  /**
   * DELETE subs/:id
   */
  api.delete<{
    Params: {
      id: string;
    };
  }>(
    '/subs/:id',
    {
      schema: {
        params: {
          id: zodToJsonSchema($SafeId),
        },
        response: {
          200: {
            type: 'null',
            description: 'Accepted',
          },
        },
      },
    },
    async (request, reply) => {
      await switchboard.unsubscribe(request.params.id);

      reply.send();
    }
  );
}
