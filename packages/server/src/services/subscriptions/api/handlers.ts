import { AuthorizationError } from '@/errors.js'
import { AgentId } from '@/lib.js'
import { FastifyRequest } from 'fastify'
import { Subscription } from '../types.js'

export interface SubscriptionPathParams {
  subscriptionId: string
  agentId: AgentId
}

declare module 'fastify' {
  interface FastifyRequest {
    subscription?: Subscription
  }
}
function ensureOwnership(request: FastifyRequest, sub: Subscription) {
  if (request.account === undefined || request.account.subject !== sub.owner) {
    throw new AuthorizationError()
  }
}

export async function OnlyOwner(
  request: FastifyRequest<{
    Params: SubscriptionPathParams
  }>,
) {
  const { agentId, subscriptionId } = request.params
  const sub = await request.server.switchboard.getSubscriptionById(agentId, subscriptionId)

  if (request.server.authEnabled) {
    ensureOwnership(request, sub)
  }

  request.subscription = sub
}
