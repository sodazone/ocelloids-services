import { $AgentId, AgentId, AnyQueryArgs, QueryParams } from '@/services/agents/types.js'
import { CAP_READ } from '@/services/auth/index.js'
import { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Agents HTTP API
 */
export async function AgentsApi(api: FastifyInstance) {
  const { agentCatalog: agentService } = api

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
            agentId: zodToJsonSchema($AgentId),
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
      reply.send(await agentService.getAgentIds())
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
            agentId: zodToJsonSchema($AgentId),
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
      reply.send(zodToJsonSchema(await agentService.getAgentInputSchema(agentId)))
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
            agentId: zodToJsonSchema($AgentId),
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
      reply.send(zodToJsonSchema(await agentService.getAgentQuerySchema(agentId)))
    },
  )

  /**
   * GET agents/:agentId/sse
   */
  api.get<{
    Params: {
      agentId: AgentId
    }
    Querystring: AnyQueryArgs
  }>(
    '/agents/:agentId/sse',
    {
      // TODO configure rate limits for SSE
      //config: {
      //  caps: [CAP_READ],
      //},
      schema: {
        tags: ['agents'],
        // TODO: token in query string + DoS protection
        // security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            agentId: zodToJsonSchema($AgentId),
          },
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
      const { agentId } = request.params
      const agent = agentService.getStreamableById(agentId)
      agent.onServerSideEventsRequest({
        filters: request.query,
        request: request.raw,
        reply,
      })
    },
  )
}
