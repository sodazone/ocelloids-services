import { $AgentId, AgentId, AnyQueryArgs, QueryParams } from '@/services/agents/types.js'
import { CAP_READ } from '@/services/auth/index.js'
import { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'

const SECONDS_TO_EXPIRE = 15

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
   * Issue a short-lived NOD (No-DoS) token for Server-Sent Events.
   *
   * This endpoint generates and signs a temporary JWT that can be
   * passed as a `?nod=` query parameter when opening
   * an SSE stream. It’s separate from the main stream endpoint so
   * we can apply custom issuance logic per agent, per stream, or per
   * delivery mechanism (WebSocket vs SSE) in the future.
   *
   * Typical flow:
   *   1. Client calls this endpoint to obtain a short-lived token.
   *   2. Client opens `/agents/:agentId/streams/:streamName?nod=<token>`
   *      using `EventSource`.
   *
   * @see `ws/nod` route for the WebSocket equivalent.
   */
  api.get(
    '/sse/nod/:agentId/:streamName',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['agents'],
        params: {
          type: 'object',
          properties: {
            agentId: zodToJsonSchema($AgentId),
            streamName: { type: 'string' },
          },
          required: ['agentId', 'streamName'],
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: { type: 'string' },
        },
      },
    },
    async (_request, reply) => {
      // seconds since the epoch
      const iat = Math.round(Date.now() / 1_000)
      const exp = iat + SECONDS_TO_EXPIRE

      reply.send({
        token: await reply.jwtSign({
          iat,
          exp,
        }),
      })
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
      config: { ensureNod: true },
      // TODO configure rate limits for SSE
      schema: {
        tags: ['agents'],
        params: {
          type: 'object',
          properties: {
            agentId: zodToJsonSchema($AgentId),
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
