import { OcelloidsAgentApi } from '../core/api'
import { OcelloidsClient } from '../core/client'
import {
  EventId,
  QueryableApi,
  StreamableApi,
  SubscribableWithReplayApi,
  SubscribeReplayContext,
} from '../core/types'
import { OnDemandSubscriptionHandlers, SubscriptionId, WebSocketHandlers } from '../lib'
import {
  CrosschainSubscriptionInputs,
  FullJourneyResponse,
  XcQueryArgs,
  XcQueryResponse,
  XcServerSentEventArgs,
} from './types'

/**
 * The crosschain agent API.
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

  /**
   * TODO: revisit for a solution on how to fill long-range gaps.
   * Probably storing the event using sequential IDs.
   */
  async subscribeWithReplay(
    subscription: SubscriptionId | CrosschainSubscriptionInputs,
    handlers: WebSocketHandlers<FullJourneyResponse>,
    replay: SubscribeReplayContext,
    onDemandHandlers?: OnDemandSubscriptionHandlers<CrosschainSubscriptionInputs>,
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
          op: 'journeys.by_id_range',
          criteria: {
            networks,
            start: Number(from) + 1,
            ...(to !== undefined ? { end: Number(to) - 1 } : {}),
          },
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
}
