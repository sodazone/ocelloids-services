import { AuthorizationError } from '@/errors.js'
import { AgentId } from '@/lib.js'
import { FastifyRequest } from 'fastify'
import { Subscription } from '../types.js'

declare module 'fastify' {
  interface FastifyRequest {
    subscription?: Subscription
  }
}

/**
 * Ensures the request account owns the subscription.
 *
 * @param request - The Fastify request object.
 * @param sub - The subscription to check ownership of.
 * @throws {AuthorizationError} If the request account does not own the subscription.
 */
function ensureOwnership(request: FastifyRequest, sub: Subscription) {
  if (request.account === undefined || request.account.subject !== sub.owner) {
    throw new AuthorizationError()
  }
}

type SubscriptionRequest = FastifyRequest<{
  Params: SubscriptionPathParams
}>

async function subscriptionFromRequest(request: SubscriptionRequest) {
  const { agentId, subscriptionId } = request.params
  return await request.server.switchboard.getSubscriptionById(agentId, subscriptionId)
}

export interface SubscriptionPathParams {
  subscriptionId: string
  agentId: AgentId
}

/**
 * Middleware to ensure only the owner can access the subscription.
 * Fetches the subscription and checks ownership if auth is enabled.
 *
 * @param request - The Fastify request object.
 * @throws {AuthorizationError} If the request account does not own the subscription.
 */
export async function OnlyOwner(request: SubscriptionRequest) {
  const sub = await subscriptionFromRequest(request)

  if (request.server.authEnabled) {
    ensureOwnership(request, sub)
  }

  request.subscription = sub
}

/**
 * Middleware to ensure access to owned or publicly flagged subscriptions.
 *
 * @param request - The Fastify request object.
 * @throws {AuthorizationError} If the request account does not own the subscription and it is not public.
 */
export async function OwnerOrPublic(request: SubscriptionRequest) {
  const sub = await subscriptionFromRequest(request)

  if (request.server.authEnabled && sub.public !== true) {
    ensureOwnership(request, sub)
  }

  request.subscription = sub
}
