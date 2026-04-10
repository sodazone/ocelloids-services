import { FastifyInstance } from 'fastify'
import z from 'zod'
import {
  $AgentId,
  AgentId,
  AnyQueryArgs,
  AnySubmitPayload,
  isSubmittable,
  QueryParams,
} from '@/services/agents/types.js'
import { CAP_ADMIN, CAP_READ } from '@/services/auth/index.js'

/**
 * Agents HTTP API
 */
export async function AgentsApi(api: FastifyInstance) {
  const { agentCatalog: agentService } = api

  /**
   * POST /submit/:agentId
   */
  api.post<{
    Params: { agentId: AgentId }
    Body: AnySubmitPayload
  }>(
    '/submit/:agentId',
    {
      config: {
        caps: [CAP_ADMIN],
      },
      schema: {
        tags: ['agents'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            agentId: z.toJSONSchema($AgentId),
          },
          required: ['agentId'],
        },
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      const agent = agentService.getAgentById(agentId)

      if (!agent) {
        return reply.status(404).send({ error: 'Agent not found' })
      }

      if (!isSubmittable(agent)) {
        return reply.status(400).send({ error: 'Agent cannot accept published data' })
      }

      try {
        await agent.submit(request.body)
        reply.send({ success: true })
      } catch (err) {
        request.log.error(err, '[agent:%s] submit failed', agentId)
        reply.status(500).send({ error: 'Failed to submit payload' })
      }
    },
  )

  /**
   * POST /query/:agentId
   */
  api.post<{
    Params: {
      agentId: AgentId
    }
    Body: QueryParams
  }>(
    '/query/:agentId',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['agents'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            agentId: z.toJSONSchema($AgentId),
          },
        },
        body: {
          type: 'object',
          required: ['args'],
          properties: {
            pagination: {
              type: 'object',
              properties: {
                cursor: { type: 'string' },
                limit: { type: 'number' },
              },
            },
            args: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      const agent = agentService.getQueryableById(agentId)
      reply.send(await agent.query(request.body))
    },
  )

  /**
   * GET agents
   */
  api.get(
    '/agents',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['agents'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    async (_, reply) => {
      reply.send(agentService.getAgentIds())
    },
  )

  /**
   * GET agents/:agentId/inputs
   */
  api.get<{
    Params: {
      agentId: AgentId
    }
  }>(
    '/agents/:agentId/inputs',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['agents'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            agentId: z.toJSONSchema($AgentId),
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      reply.send(z.toJSONSchema(agentService.getAgentInputSchema(agentId)))
    },
  )

  /**
   * GET agents/:agentId/queries
   */
  api.get<{
    Params: {
      agentId: AgentId
    }
  }>(
    '/agents/:agentId/queries',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['agents'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            agentId: z.toJSONSchema($AgentId),
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = request.params
      reply.send(z.toJSONSchema(agentService.getAgentQuerySchema(agentId)))
    },
  )

  /**
   * GET sse/:agentId/:streamName
   */
  api.get<{
    Params: {
      agentId: AgentId
      streamName: string
    }
    Querystring: AnyQueryArgs
  }>(
    '/sse/:agentId/:streamName',
    {
      schema: {
        tags: ['agents'],
        params: {
          type: 'object',
          properties: {
            agentId: z.toJSONSchema($AgentId),
            streamName: { type: 'string' },
          },
          required: ['agentId', 'streamName'],
        },
        querystring: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: {
            description: 'SSE stream',
            content: {
              'text/event-stream': {
                schema: { type: 'string', description: 'SSE event stream' },
              },
            },
          },
          404: { type: 'string' },
        },
      },
    },
    async (request, reply) => {
      const { agentId, streamName } = request.params
      const agent = agentService.getStreamableById(agentId)
      agent.onServerSentEventsRequest({
        streamName,
        filters: request.query,
        request: request.raw,
        uid: request.ip,
        reply,
      })

      return reply
    },
  )
}
