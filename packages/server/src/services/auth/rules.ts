import { FastifyInstance, FastifyRequest } from 'fastify'
import { CAP_ADMIN } from './caps.js'
import { JwtPayload } from './types.js'

/**
 * Ensure the requested capabilities are present in the scope.
 */
function ensureCapabilities(scope: string, requestedCaps: string[] = [CAP_ADMIN]) {
  if (scope) {
    const caps = scope.split(' ')

    if (requestedCaps.length === 0 || requestedCaps.every((required) => caps.includes(required))) {
      return
    }
  }

  throw new Error('Not allowed')
}

/**
 * Ensure the account associated with the JWT is authorized.
 */
export async function ensureAccountAuthorized(
  { log, accountsRepository }: FastifyInstance,
  request: FastifyRequest,
  payload: JwtPayload,
) {
  if (payload) {
    const { sub, jti } = payload

    const apiToken = await accountsRepository.findApiTokenById(jti)

    if (apiToken?.status === 'enabled') {
      const { account } = apiToken
      if (account) {
        if (account.status === 'enabled' && account.subject === sub) {
          const {
            routeOptions: {
              config: { caps },
            },
          } = request

          ensureCapabilities(apiToken.scope, caps)

          // all OK
          request.account = account
          return
        } else {
          log.warn('[authorization] disabled account attempt %j', apiToken)
        }
      } else {
        log.warn('[authorization] token without associated account %j', apiToken)
      }
    } else {
      log.warn('[authorization] disabled token attempt %j', apiToken)
    }
  }

  throw new Error('Not allowed')
}
