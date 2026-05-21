import { OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { EventId, SubscribableWithReplayApi, SubscribeReplayContext } from '../core/types'
import { NetworkURN, OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import { DefiAgentInputs, DefiEventPayload, DefiSubscriptionPayload } from './types'

/**
 * @public
 */
export class DefiAgentApi
  extends OcelloidsAgentApi<DefiAgentInputs>
  implements SubscribableWithReplayApi<DefiAgentInputs, DefiSubscriptionPayload>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'defi', clientApi)
  }

  async subscribeWithReplay(
    subscription: SubscriptionId | DefiAgentInputs,
    handlers: WebSocketHandlers<DefiSubscriptionPayload>,
    replayContext: SubscribeReplayContext,
    onDemandHandlers?: OnDemandSubscriptionHandlers<DefiAgentInputs>,
  ) {
    const { networks, topic } = await this.resolveInputsFromSubscription(subscription)

    if (topic === 'event') {
      return this.subscribeWithReplayStrategy(
        subscription,
        handlers as WebSocketHandlers<DefiEventPayload>,
        replayContext,
        {
          buildReplayQuery: this.#buildReplayQuery(networks !== '*' ? networks : undefined),
          buildReplayedMessageMetadata: this.#buildReplayMetadata,
        },
        onDemandHandlers,
      )
    } else {
      return this.subscribe(subscription, handlers)
    }
  }

  #buildReplayQuery(networks?: NetworkURN[]) {
    return (from?: EventId, to?: EventId) => {
      if (from === undefined) {
        return null
      }

      return {
        args: {
          op: 'events',
          criteria: {
            networks,
          },
        },
        pagination: {
          cursor: String(from),
        },
      }
    }
  }

  #buildReplayMetadata(payload: DefiSubscriptionPayload) {
    return {
      type: `${payload.type}.replay`,
      agentId: 'defi',
      networkId: payload.networkId,
      timestamp: Date.now(),
    }
  }
}
