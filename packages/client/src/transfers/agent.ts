import { _isAnySubscriptionInputs, OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { SubscribableWithReplayApi } from '../core/types'
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
    replay: {
      lastSeenId?: number
      onPersist: (id: number) => Promise<void>
      onCompleteRange?: () => void
      onIncompleteRange?: (range: { from: number | null; to: number | null }) => Promise<void>
    },
    onDemandHandlers?: OnDemandSubscriptionHandlers<TransfersAgentInputs>,
  ) {
    let networks: string[] | '*' = '*'

    if (_isAnySubscriptionInputs(subscription)) {
      networks = subscription.networks
    } else {
      networks = (await this.getSubscription(subscription)).args.networks
    }

    return this.subscribeWithReplayStrategy(
      subscription,
      handlers,
      replay,
      {
        buildReplayQuery: this.#buildQuery(networks !== '*' ? networks : undefined),
        buildMessageMetadata: this.#buildMetadata,
      },
      onDemandHandlers,
    )
  }

  #buildQuery(networks?: string[]) {
    return (from?: number, to?: number) => {
      if (from === undefined) {
        return null
      }

      return {
        op: 'transfers.by_id_range',
        criteria: {
          networks,
          start: from + 1,
          ...(to !== undefined ? { end: to - 1 } : {}),
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
