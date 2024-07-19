import { FastifyInstance, FastifyRequest } from 'fastify'
import { Operation } from 'rfc6902'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, AgentId } from '@/services/agents/types.js'
import { CAP_READ, CAP_WRITE } from '@/services/auth.js'

import {
  $NewSubscription,
  $PublicSubscription,
  $Subscription,
  $SubscriptionId,
  NewSubscription,
} from '../types.js'
import { OnlyOwner, PublicOrOwner, SubscriptionPathParams } from './handlers.js'
import $JSONPatch from './json-patch.js'

/**
 * Subscriptions HTTP API.
 */
export async function SubscriptionApi(api: FastifyInstance) {
  const { switchboard } = api

  // Route to get all subscriptions of an agent
  // that are readable by the current subject
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
            items: zodToJsonSchema($PublicSubscription),
          },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      reply.send(await switchboard.getSubscriptionsByAgentId(agentId, request.account?.subject))
    },
  )

  // Route to retrieve a subscription from an agent
  api.get<{
    Params: SubscriptionPathParams
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_READ],
      },
      preHandler: [PublicOrOwner],
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
      reply.send(request.subscription)
    },
  )

  // Route to subscribe to an agent
  api.post<{
    Body: NewSubscription | NewSubscription[]
  }>(
    '/subs',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        body: {
          oneOf: [
            zodToJsonSchema($NewSubscription),
            {
              type: 'array',
              items: zodToJsonSchema($NewSubscription),
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
      await switchboard.subscribe(subs, request.account?.subject)
      reply.status(201).send()
    },
  )

  // Route to update subscriptons
  api.patch<{
    Params: SubscriptionPathParams
    Body: Operation[]
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_WRITE],
      },
      preHandler: [OnlyOwner],
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

  // Route to delete subscriptions
  api.delete<{
    Params: SubscriptionPathParams
  }>(
    '/subs/:agentId/:subscriptionId',
    {
      config: {
        caps: [CAP_WRITE],
      },
      preHandler: [OnlyOwner],
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
