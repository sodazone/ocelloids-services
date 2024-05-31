import { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { $AgentId, AgentId } from '../types.js'

/**
 * Agents HTTP API
 */
export async function AgentsApi(api: FastifyInstance) {
  const { agentCatalog: agentService } = api

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
    }
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
    }
  )
}
