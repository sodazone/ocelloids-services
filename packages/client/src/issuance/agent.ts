import { _isAnySubscriptionInputs, OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { QueryableApi, SubscribableApi } from '../core/types'
import { NetworkURN, OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import { CrosschainIssuanceInputs, CrosschainIssuancePayload, CrosschainIssuanceQueryArgs } from './types'

/**
 * @public
 */
export class CrosschainIssuanceAgentApi
  extends OcelloidsAgentApi<CrosschainIssuanceInputs>
  implements
    SubscribableApi<CrosschainIssuanceInputs, CrosschainIssuancePayload>,
    QueryableApi<CrosschainIssuanceQueryArgs, CrosschainIssuancePayload>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'issuance', clientApi)
  }

  async subscribe<P = CrosschainIssuancePayload>(
    subscription: SubscriptionId | CrosschainIssuanceInputs,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<CrosschainIssuanceInputs>,
  ) {
    if (_isAnySubscriptionInputs(subscription)) {
      return super.subscribe(subscription, handlers, onDemandHandlers)
    }

    const { items } = await this.query<CrosschainIssuanceQueryArgs, CrosschainIssuancePayload>({
      op: 'issuance.last',
      criteria: {
        subscriptionId: subscription,
      },
    })

    const ws = await super.subscribe(subscription, handlers, onDemandHandlers)

    if (items.length > 0) {
      const payload = items[0]
      handlers.onMessage(
        {
          metadata: {
            type: 'issuance',
            subscriptionId: subscription,
            agentId: 'issuance',
            networkId: payload.inputs.reserveChain as NetworkURN,
            timestamp: Date.now(),
          },
          payload,
        } as any,
        ws,
        undefined as any,
      )
    }

    return ws
  }
}
