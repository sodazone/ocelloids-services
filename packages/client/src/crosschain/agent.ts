import { _isAnySubscriptionInputs, OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import { QueryableApi, StreamableApi, SubscribableWithReplayApi } from '../core/types'
import { OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import {
  CrosschainSubscriptionInputs,
  FullJourneyResponse,
  XcQueryArgs,
  XcQueryResponse,
  XcServerSentEventArgs,
} from './types'

const TERMINAL_STATUSES = ['received', 'timeout', 'failed']

/**
 * @public
 */
export class CrosschainAgentApi
  extends OcelloidsAgentApi<CrosschainSubscriptionInputs>
  implements
    SubscribableWithReplayApi<CrosschainSubscriptionInputs, FullJourneyResponse>,
    QueryableApi<XcQueryArgs, XcQueryResponse>,
    StreamableApi<
      { streamName: 'default'; args: XcServerSentEventArgs },
      | { event: 'new_journey'; onData: (data: FullJourneyResponse) => void }
      | { event: 'update_journey'; onData: (data: FullJourneyResponse) => void }
    >
{
  constructor(clientApi: OcelloidsClient) {
    super(clientApi.config, 'crosschain', clientApi)
  }

  async subscribeWithReplay(
    subscription: SubscriptionId | CrosschainSubscriptionInputs,
    handlers: WebSocketHandlers<FullJourneyResponse>,
    replay: {
      lastSeenId?: number
      onPersist: (id: number) => Promise<void>
      onCompleteRange?: () => void
      onIncompleteRange?: (range: { from: number | null; to: number | null }) => Promise<void>
    },
    onDemandHandlers?: OnDemandSubscriptionHandlers<CrosschainSubscriptionInputs>,
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
        persist: this.#persist(replay.onPersist),
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
        op: 'journeys.by_id_range',
        criteria: {
          networks,
          start: from + 1,
          ...(to !== undefined ? { end: to - 1 } : {}),
        },
      }
    }
  }

  #buildMetadata(payload: FullJourneyResponse) {
    return {
      type: 'xc-journeys.replay',
      agentId: 'crosschain',
      networkId: payload.origin,
      timestamp: Date.now(),
      blockTimestamp: payload.sentAt,
    }
  }

  #persist(onPersist: (id: number) => Promise<void>) {
    const sentIds = new Set<number>()
    let lastPersisted: number | null = null

    const getLowest = () => (sentIds.size ? Math.min(...sentIds) : null)

    return async (payload: FullJourneyResponse) => {
      const id = payload.id

      if (TERMINAL_STATUSES.includes(payload.status)) {
        sentIds.delete(id)
      } else {
        sentIds.add(id)
      }

      const lowest = getLowest()

      if (lowest !== lastPersisted) {
        lastPersisted = lowest
        await onPersist(lowest ?? id)
      }
    }
  }
}
