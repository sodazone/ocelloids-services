import { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, AgentId, QueryParams } from '../types.js'

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
      schema: {
        params: {
          agentId: zodToJsonSchema($AgentId),
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
      const agent = await agentService.getQueryableById(agentId)
      reply.send(await agent.query(request.body))
    },
  )

  /**
   * GET agents
   */
  api.get(
    '/agents',
    {
      schema: {
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
      schema: {
        params: {
          agentId: zodToJsonSchema($AgentId),
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
      schema: {
        params: {
          agentId: zodToJsonSchema($AgentId),
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
}
