import { OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { EventId, SubscribableWithReplayApi, SubscribeReplayContext } from '../core/types'
import { OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import { IcTransferResponse, TransfersAgentInputs } from './types'

/**
 * @public
 */
export class TransfersAgentApi
  extends OcelloidsAgentApi<TransfersAgentInputs>
  implements SubscribableWithReplayApi<TransfersAgentInputs, IcTransferResponse>
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'transfers', clientApi)
  }

  async subscribeWithReplay(
    subscription: SubscriptionId | TransfersAgentInputs,
    handlers: WebSocketHandlers<IcTransferResponse>,
    replay: SubscribeReplayContext,
    onDemandHandlers?: OnDemandSubscriptionHandlers<TransfersAgentInputs>,
  ) {
    const { networks } = await this.resolveInputsFromSubscription(subscription)

    return this.subscribeWithReplayStrategy(
      subscription,
      handlers,
      replay,
      {
        buildReplayQuery: this.#buildQuery(networks !== '*' ? networks : undefined),
        buildReplayedMessageMetadata: this.#buildMetadata,
      },
      onDemandHandlers,
    )
  }

  #buildQuery(networks?: string[]) {
    return (from?: EventId, to?: EventId) => {
      if (from === undefined) {
        return null
      }

      return {
        args: {
          op: 'transfers.by_id_range',
          criteria: {
            networks,
            start: Number(from) + 1,
            ...(to !== undefined ? { end: Number(to) - 1 } : {}),
          },
        },
      }
    }
  }

  #buildMetadata(payload: IcTransferResponse) {
    return {
      type: 'transfers.replay',
      agentId: 'transfers',
      networkId: payload.network,
      timestamp: Date.now(),
      blockTimestamp: payload.sentAt,
    }
  }
}
