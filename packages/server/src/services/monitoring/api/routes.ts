import { FastifyInstance } from 'fastify'
import { Operation, applyPatch } from 'rfc6902'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, $SafeId, $Subscription, AgentId, Subscription } from '../types.js'
import $JSONPatch from './json-patch.js'

/* TODO extract this
const allowedPaths = ['/senders', '/destinations', '/channels', '/events']

function hasOp(patch: Operation[], path: string) {
  return patch.some((op) => op.path.startsWith(path))
}*/

/**
 * Subscriptions HTTP API.
 */
export async function SubscriptionApi(api: FastifyInstance) {
  const { switchboard, subsStore } = api

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
      reply.send(await subsStore.getAll())
    }
  )

  /**
   * GET subs/:id
   */
  api.get<{
    Params: {
      id: string
    }
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
      reply.send(await subsStore.getById(request.params.id))
    }
  )

  /**
   * POST subs
   */
  api.post<{
    Body: Subscription | Subscription[]
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
      const subs = request.body
      if (Array.isArray(subs)) {
        const tmp = []
        try {
          for (const s of subs) {
            await switchboard.subscribe(s)
            tmp.push(s)
          }
        } catch (error) {
          for (const s of tmp) {
            await switchboard.unsubscribe(s.agent, s.id)
          }
          throw error
        }
      } else {
        await switchboard.subscribe(subs)
      }

      reply.status(201).send()
    }
  )

  /**
   * PATCH subs/:id
   */
  api.patch<{
    Params: {
      id: string
    }
    Body: Operation[]
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
    async (_request, reply) => {
      /*
      const patch = request.body
      const { id } = request.params
      const sub = await subsStore.getById(id)

      // Check allowed patch ops
      const allowedOps = patch.every((op) => allowedPaths.some((s) => op.path.startsWith(s)))

      if (allowedOps) {
        applyPatch(sub, patch)
        $Subscription.parse(sub)

        await subsStore.save(sub)

        switchboard.updateSubscription(sub)

        if (hasOp(patch, '/senders')) {
          switchboard.updateSenders(id)
        }

        if (hasOp(patch, '/destinations')) {
          switchboard.updateDestinations(id)
        }

        if (hasOp(patch, '/events')) {
          switchboard.updateEvents(id)
        }

        reply.status(200).send(sub)
      } else {
        reply.status(400).send('Only operations on these paths are allowed: ' + allowedPaths.join(','))
      }*/
      reply.status(400)
    }
  )

  /**
   * DELETE subs/:id
   */
  api.delete<{
    Params: {
      agent: AgentId
      id: string
    }
  }>(
    '/subs/:agent/:id',
    {
      schema: {
        params: {
          agent: zodToJsonSchema($AgentId),
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
      const { agent, id } = request.params
      await switchboard.unsubscribe(agent, id)

      reply.send()
    }
  )
}
