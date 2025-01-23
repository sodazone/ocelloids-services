import { OcelloidsClient, OcelloidsClientConfig, QueryableApi, SubscribableApi } from './client'
import { AnySubscriptionInputs } from './types'

import { AssetMetadata, StewardQueryArgs } from './steward/types'
import { XcmInputs, XcmMessagePayload } from './xcm/types'

type KnownAgentIds = 'xcm' | 'steward' | 'informant'

function createAgent<I = AnySubscriptionInputs>(id: KnownAgentIds, opts: OcelloidsClientConfig) {
  return new OcelloidsClient(opts).agent<I>(id)
}

export function createXcmAgent(opts: OcelloidsClientConfig): SubscribableApi<XcmInputs, XcmMessagePayload> {
  return createAgent<XcmInputs>('xcm', opts)
}

export function createStewardAgent(
  opts: OcelloidsClientConfig,
): QueryableApi<StewardQueryArgs, AssetMetadata> {
  return createAgent('steward', opts)
}

export function createInformantAgent(opts: OcelloidsClientConfig): SubscribableApi {
  return createAgent('informant', opts)
}
