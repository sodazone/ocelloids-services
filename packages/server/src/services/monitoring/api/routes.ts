import { FastifyInstance } from 'fastify'
import { Operation } from 'rfc6902'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, $SafeId, $Subscription, AgentId, Subscription } from '../types.js'
import $JSONPatch from './json-patch.js'

/**
 * Subscriptions HTTP API.
 */
export async function SubscriptionApi(api: FastifyInstance) {
  const { switchboard } = api

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
      reply.send(await switchboard.getAllSubscriptions())
    }
  )

  /**
   * GET subs/:agent/:id
   */
  api.get<{
    Params: {
      id: string
      agent: AgentId
    }
  }>(
    '/subs/:id',
    {
      schema: {
        params: {
          id: zodToJsonSchema($SafeId),
          agent: zodToJsonSchema($AgentId),
        },
        response: {
          200: zodToJsonSchema($Subscription),
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agent, id } = request.params
      reply.send(await switchboard.getSubscriptionById(agent, id))
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
      agent: AgentId
    }
    Body: Operation[]
  }>(
    '/subs/:agent/:id',
    {
      schema: {
        params: {
          id: zodToJsonSchema($SafeId),
          agent: zodToJsonSchema($AgentId),
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
      const patch = request.body
      const { agent, id } = request.params

      try {
        const res = await switchboard.updateSubscription(agent, id, patch)
        reply.status(200).send(res)
      } catch (error) {
        reply.status(400).send(error)
      }
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
