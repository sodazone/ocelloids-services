import { FastifyInstance } from 'fastify'
import { Operation } from 'rfc6902'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, AgentId } from '../../agents/types.js'
import { CAP_READ, CAP_WRITE } from '../../auth.js'
import { $Subscription, $SubscriptionId, Subscription } from '../types.js'
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
      config: {
        caps: [CAP_READ],
      },
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
    },
  )

  /**
   * GET subs/:agentId
   */
  api.get<{
    Params: {
      agentId: AgentId
    }
  }>(
    '/subs/:agentId',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        params: {
          agentId: zodToJsonSchema($AgentId),
        },
        response: {
          200: {
            type: 'array',
            items: zodToJsonSchema($Subscription),
          },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      reply.send(await switchboard.getSubscriptionsByAgentId(agentId))
    },
  )

  /**
   * GET subs/:agentId/:subscriptionId
   */
  api.get<{
    Params: {
      subscriptionId: string
      agentId: AgentId
    }
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        params: {
          subscriptionId: zodToJsonSchema($SubscriptionId),
          agentId: zodToJsonSchema($AgentId),
        },
        response: {
          200: zodToJsonSchema($Subscription),
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId, subscriptionId } = request.params
      reply.send(await switchboard.getSubscriptionById(agentId, subscriptionId))
    },
  )

  /**
   * POST subs
   */
  api.post<{
    Body: Subscription | Subscription[]
  }>(
    '/subs',
    {
      config: {
        caps: [CAP_WRITE],
      },
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
      await switchboard.subscribe(subs)
      reply.status(201).send()
    },
  )

  /**
   * PATCH subs/:agentId/:subscriptionId
   */
  api.patch<{
    Params: {
      subscriptionId: string
      agentId: AgentId
    }
    Body: Operation[]
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        params: {
          subscriptionId: zodToJsonSchema($SubscriptionId),
          agentId: zodToJsonSchema($AgentId),
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
      const { agentId, subscriptionId } = request.params

      try {
        const res = await switchboard.updateSubscription(agentId, subscriptionId, patch)
        reply.status(200).send(res)
      } catch (error) {
        reply.code(400).send((error as Error).message)
      }
    },
  )

  /**
   * DELETE subs/:agentId/:subscriptionId
   */
  api.delete<{
    Params: {
      agentId: AgentId
      subscriptionId: string
    }
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        params: {
          agentId: zodToJsonSchema($AgentId),
          subscriptionId: zodToJsonSchema($SubscriptionId),
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
      const { agentId, subscriptionId } = request.params
      await switchboard.unsubscribe(agentId, subscriptionId)

      reply.send()
    },
  )
}
