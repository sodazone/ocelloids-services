import { OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { EventId, SubscribableWithReplayApi, SubscribeReplayContext } from '../core/types'
import { isSubscriptionInputs } from '../core/utils'
import { NetworkURN, OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import { DefiAgentInputs, DefiAgentQueryArgs, DefiEventPayload, DefiLiquidityPayload, DefiSubscriptionPayload } from './types'

/**
 * @public
 */
export class DefiAgentApi
  extends OcelloidsAgentApi<DefiAgentInputs, DefiSubscriptionPayload>
  implements SubscribableWithReplayApi<DefiAgentInputs, DefiSubscriptionPayload>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'defi', clientApi)
  }

  async subscribe(
    subscription: string | DefiAgentInputs,
    handlers: WebSocketHandlers<DefiSubscriptionPayload>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<DefiAgentInputs> | undefined,
  ): Promise<WebSocket> {
    return super.subscribe(subscription, handlers, onDemandHandlers)
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
    } else if(topic === 'liquidity') {
      if (isSubscriptionInputs(subscription)) {
        return super.subscribe(subscription, handlers, onDemandHandlers)
      }

      const { items } = await this.query<DefiAgentQueryArgs, DefiLiquidityPayload>({
        op: 'liquidity.last',
        criteria: {
          networks
        }
      })

      const ws = await super.subscribe(subscription, handlers, onDemandHandlers)
      for (const payload of items) {
        handlers.onMessage(
          {
            metadata: {
              type: 'liquidity',
              subscriptionId: subscription,
              agentId: 'defi',
              networkId: payload.networkId,
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

    throw new Error("topic not supported")
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
