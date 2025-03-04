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
 * This function acts as a factory for creating agent instances.
 * It accepts either configuration options for a new OcelloidsClient or an existing
 * client instance. The returned agent provides access to specialized methods
 * (e.g., subscribing to events, querying data) and the general client API.
 *
 * @param id The ID of the agent to create ('xcm', 'steward', or 'informant').
 * @param optsOrClient Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
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
 *
 * @param optsOrClient Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for subscribing to XCM events and accessing general client API methods.
 */
export function createXcmAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): SubscribableApi<XcmInputs, XcmMessagePayload> & OcelloidsClientApi {
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
 *
 * @param optsOrClient Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for querying asset metadata and accessing general client API methods.
 */
export function createStewardAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): QueryableApi<StewardQueryArgs, AssetMetadata> & OcelloidsClientApi {
  return createAgent('steward', optsOrClient)
}

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
 *
 * @param optsOrClient Configuration options for the OcelloidsClient, or an existing OcelloidsClient instance.
 * @returns An object with methods for subscribing to events and accessing general client API methods.
 */
export function createInformantAgent(
  optsOrClient: OcelloidsClientConfig | OcelloidsClient,
): SubscribableApi & OcelloidsClientApi {
  return createAgent('informant', optsOrClient)
}
