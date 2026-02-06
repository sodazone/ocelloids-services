import {
  OcelloidsClient,
  OcelloidsClientApi,
  OcelloidsClientConfig,
  QueryableApi,
  StreamableApi,
  SubscribableApi,
  SubscribableWithReplayApi,
} from './client'
import { FullJourneyResponse, XcQueryArgs, XcQueryResponse, XcServerSentEventArgs } from './crosschain/types'

import { AnySubscriptionInputs } from './lib'
import {
  AccountData,
  AssetMetadata,
  BalancesData,
  StatusData,
  StewardQueryArgs,
  StewardServerSentEventArgs,
} from './steward/types'
import { IcTransferQueryArgs, IcTransferResponse, TransfersAgentInputs } from './transfers/types'
import { HumanizedXcmPayload, XcmInputs, XcmMessagePayload } from './xcm/types'

type KnownAgentIds = 'xcm' | 'steward' | 'informant' | 'crosschain' | 'transfers'

/**
 * Creates an agent instance.
 *
 * This function acts as a factory for creating agent instances.
 * It accepts either configuration options for a new OcelloidsClient or an existing
 * client instance. The returned agent provides access to specialized methods
 * (e.g., subscribing to events, querying data) and the general client API.
 *
 * @public
 * @param id - The ID of the agent to create ('xcm', 'steward', or 'informant').
 * @param optsOrClient - Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An instance of the specified agent with specific methods and access to the client API.
 */
function createAgent<I = AnySubscriptionInputs>(
  id: KnownAgentIds,
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
) {
  return (
    optsOrClient instanceof OcelloidsClient ? optsOrClient : new OcelloidsClient(optsOrClient)
  ).agent<I>(id)
}

/**
 * Creates an 'xcm' agent instance.
 *
 * @example
 * ```typescript
 * import { createXcmAgent } from "@sodazone/ocelloids-client";
 *
 * const agent = createXcmAgent({
 *   httpUrl: "http://127.0.0.1:3000",
 *   wsUrl: "ws://127.0.0.1:3000"
 * });
 *
 * // Subscribe to XCM events
 * const ws = await agent.subscribe(...);
 * ```
 * @public
 * @param optsOrClient - Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for subscribing to XCM events and accessing general client API methods.
 */
export function createXcmAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): SubscribableApi<XcmInputs, XcmMessagePayload | HumanizedXcmPayload> & OcelloidsClientApi {
  return createAgent<XcmInputs>('xcm', optsOrClient)
}

/**
 * Creates a 'steward' agent instance.
 *
 * @example
 * ```typescript
 * import { createStewardAgent } from "@sodazone/ocelloids-client";
 *
 * const agent = createStewardAgent({
 *   httpUrl: "http://127.0.0.1:3000"
 * });
 *
 * // Query asset metadata
 * const metadata = await agent.query({ ... });
 * ```
 * @public
 * @param optsOrClient - Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for querying asset metadata and accessing general client API methods.
 */
export function createStewardAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): QueryableApi<StewardQueryArgs, AssetMetadata> &
  StreamableApi<
    { streamName: 'balances'; args: StewardServerSentEventArgs },
    | { event: 'balance'; onData: (data: BalancesData) => void }
    | { event: 'status'; onData: (data: StatusData) => void }
    | { event: 'synced'; onData: (data: AccountData) => void }
  > &
  OcelloidsClientApi {
  return createAgent('steward', optsOrClient)
}

/**
 * @public
 */
export type StewardAgent = ReturnType<typeof createStewardAgent>

/**
 * Creates an 'informant' agent instance.
 *
 * @example
 * ```typescript
 * import { createInformantAgent } from "@sodazone/ocelloids-client";
 *
 * const agent = createInformantAgent({
 *   httpUrl: "http://127.0.0.1:3000",
 *   wsUrl: "ws://127.0.0.1:3000"
 * });
 *
 * // Subscribe to general events
 * const ws = await agent.subscribe(...);
 * ```
 * @public
 * @param optsOrClient - Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for subscribing to events and accessing general client API methods.
 */
export function createInformantAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): SubscribableApi & OcelloidsClientApi {
  return createAgent('informant', optsOrClient)
}

/**
 * @public
 */
export function createCrosschainAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): QueryableApi<XcQueryArgs, XcQueryResponse> &
  StreamableApi<
    { streamName: 'default'; args: XcServerSentEventArgs },
    | { event: 'new_journey'; onData: (data: FullJourneyResponse) => void }
    | { event: 'update_journey'; onData: (data: FullJourneyResponse) => void }
  > &
  OcelloidsClientApi {
  return createAgent('crosschain', optsOrClient)
}

/**
 * @public
 */
export type CrosschainAgent = ReturnType<typeof createCrosschainAgent>

/**
 * @public
 */
export function createTransfersAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): SubscribableWithReplayApi<
  TransfersAgentInputs,
  IcTransferResponse,
  IcTransferQueryArgs,
  IcTransferResponse
> &
  OcelloidsClientApi {
  return createAgent<TransfersAgentInputs>('transfers', optsOrClient)
}
