import {
  OcelloidsClient,
  OcelloidsClientApi,
  OcelloidsClientConfig,
  QueryableApi,
  SubscribableApi,
} from './client'
import { AnySubscriptionInputs } from './types'

import { AssetMetadata, StewardQueryArgs } from './steward/types'
import { XcmInputs, XcmMessagePayload } from './xcm/types'

type KnownAgentIds = 'xcm' | 'steward' | 'informant'

/**
 * Creates an agent instance.
 *
 * @template I The type of subscription inputs.
 * @param id The ID of the agent to create.
 * @param opts Configuration options for the OcelloidsClient.
 * @returns An instance of the specified agent.
 */
function createAgent<I = AnySubscriptionInputs>(id: KnownAgentIds, opts: OcelloidsClientConfig) {
  return new OcelloidsClient(opts).agent<I>(id)
}

/**
 * Creates an 'xcm' agent instance.
 *
 * @example
 *
 * ```typescript
 * import { createXcmAgent } from "@sodazone/ocelloids-client";
 *
 * const agent = createXcmAgent({
 *   httpUrl: "http://127.0.0.1:3000",
 *   wsUrl: "ws://127.0.0.1:3000"
 * });
 *
 * const ws = await agent.subscribe(...);
 * ```
 *
 * @param opts Configuration options for the OcelloidsClient.
 * @returns An object with methods for subscribing to XCM events and general client API methods.
 */
export function createXcmAgent(
  opts: OcelloidsClientConfig,
): SubscribableApi<XcmInputs, XcmMessagePayload> & OcelloidsClientApi {
  return createAgent<XcmInputs>('xcm', opts)
}

/**
 * Creates a 'steward' agent instance.
 *
 * @param opts Configuration options for the OcelloidsClient.
 * @returns An object with methods for querying asset metadata and general client API methods.
 */
export function createStewardAgent(
  opts: OcelloidsClientConfig,
): QueryableApi<StewardQueryArgs, AssetMetadata> & OcelloidsClientApi {
  return createAgent('steward', opts)
}

/**
 * Creates an 'informant' agent instance.
 *
 * @param opts Configuration options for the OcelloidsClient.
 * @returns An object with methods for subscribing to events and general client API methods.
 */
export function createInformantAgent(opts: OcelloidsClientConfig): SubscribableApi & OcelloidsClientApi {
  return createAgent('informant', opts)
}
