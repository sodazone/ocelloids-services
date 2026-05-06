import { OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { SubscribableApi } from '../core/types'
import { OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import { DefiAgentInputs, DefiSubscriptionPayload } from './types'

/**
 * @public
 */
export class DefiAgentApi
  extends OcelloidsAgentApi<DefiAgentInputs>
  implements SubscribableApi<DefiAgentInputs, DefiSubscriptionPayload>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'defi', clientApi)
  }

  async subscribe<P = DefiSubscriptionPayload>(
    subscription: SubscriptionId | DefiAgentInputs,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<DefiAgentInputs>,
  ) {
    return super.subscribe(subscription, handlers, onDemandHandlers)
  }
}
