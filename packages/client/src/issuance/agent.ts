import { _isAnySubscriptionInputs, OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { QueryableApi, SubscribableApi } from '../core/types'
import { NetworkURN, OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import {
  CrosschainIssuancePayload,
  CrosschainIssuanceQueryArgs,
  CrosschainIssuanceSubscriptionInputs,
} from './types'

/**
 * @public
 */
export class CrosschainIssuanceAgentApi
  extends OcelloidsAgentApi<CrosschainIssuanceSubscriptionInputs>
  implements
    SubscribableApi<CrosschainIssuanceSubscriptionInputs, CrosschainIssuancePayload>,
    QueryableApi<CrosschainIssuanceQueryArgs, CrosschainIssuancePayload>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'issuance', clientApi)
  }

  async subscribe<P = CrosschainIssuancePayload>(
    subscription: SubscriptionId | CrosschainIssuanceSubscriptionInputs,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<CrosschainIssuanceSubscriptionInputs>,
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

    for (const payload of items) {
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
