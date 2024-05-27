/* eslint-disable no-use-before-define */
import type {
  Bytes,
  Compact,
  Enum,
  Option,
  Struct,
  U8aFixed,
  Vec,
  bool,
  u8,
  u32,
  u64,
  u128,
} from '@polkadot/types-codec'
import type { ITuple } from '@polkadot/types-codec/types'

import type {
  SpWeightsWeightV2Weight,
  StagingXcmV3MultiLocation,
  XcmDoubleEncoded,
  XcmV2MultiLocation,
  XcmV2MultiassetMultiAssets,
  XcmV2OriginKind,
  XcmV2Xcm,
  XcmV3JunctionBodyId,
  XcmV3JunctionBodyPart,
  XcmV3MaybeErrorCode,
  XcmV3MultiassetMultiAssets,
  XcmV3TraitsError,
  XcmV3WeightLimit,
  XcmV3Xcm,
  XcmV2MultilocationJunctions,
  XcmV3Junctions
} from '@polkadot/types/lookup'

/** @name XcmVersionedXcm (296) */
export interface XcmVersionedXcm extends Enum {
  readonly isV2: boolean
  readonly asV2: XcmV2Xcm
  readonly isV3: boolean
  readonly asV3: XcmV3Xcm
  readonly isV4: boolean
  readonly asV4: XcmV4Xcm
  readonly type: 'V2' | 'V3' | 'V4'
}

/** @name XcmVersionedLocation (70) */
export interface XcmVersionedLocation extends Enum {
  readonly isV2: boolean
  readonly asV2: XcmV2MultiLocation
  readonly isV3: boolean
  readonly asV3: StagingXcmV3MultiLocation
  readonly isV4: boolean
  readonly asV4: XcmV4Location
  readonly type: 'V2' | 'V3' | 'V4'
}

/** @name XcmVersionedAssets (358) */
export interface XcmVersionedAssets extends Enum {
  readonly isV2: boolean
  readonly asV2: XcmV2MultiassetMultiAssets
  readonly isV3: boolean
  readonly asV3: XcmV3MultiassetMultiAssets
  readonly isV4: boolean
  readonly asV4: XcmV4AssetAssets
  readonly type: 'V2' | 'V3' | 'V4'
}

/** @name XcmV4Xcm (340) */
export interface XcmV4Xcm extends Vec<XcmV4Instruction> {}

/** @name XcmV4Instruction (342) */
export interface XcmV4Instruction extends Enum {
  readonly isWithdrawAsset: boolean
  readonly asWithdrawAsset: XcmV4AssetAssets
  readonly isReserveAssetDeposited: boolean
  readonly asReserveAssetDeposited: XcmV4AssetAssets
  readonly isReceiveTeleportedAsset: boolean
  readonly asReceiveTeleportedAsset: XcmV4AssetAssets
  readonly isQueryResponse: boolean
  readonly asQueryResponse: {
    readonly queryId: Compact<u64>
    readonly response: XcmV4Response
    readonly maxWeight: SpWeightsWeightV2Weight
    readonly querier: Option<XcmV4Location>
  } & Struct
  readonly isTransferAsset: boolean
  readonly asTransferAsset: {
    readonly assets: XcmV4AssetAssets
    readonly beneficiary: XcmV4Location
  } & Struct
  readonly isTransferReserveAsset: boolean
  readonly asTransferReserveAsset: {
    readonly assets: XcmV4AssetAssets
    readonly dest: XcmV4Location
    readonly xcm: XcmV4Xcm
  } & Struct
  readonly isTransact: boolean
  readonly asTransact: {
    readonly originKind: XcmV2OriginKind
    readonly requireWeightAtMost: SpWeightsWeightV2Weight
    readonly call: XcmDoubleEncoded
  } & Struct
  readonly isHrmpNewChannelOpenRequest: boolean
  readonly asHrmpNewChannelOpenRequest: {
    readonly sender: Compact<u32>
    readonly maxMessageSize: Compact<u32>
    readonly maxCapacity: Compact<u32>
  } & Struct
  readonly isHrmpChannelAccepted: boolean
  readonly asHrmpChannelAccepted: {
    readonly recipient: Compact<u32>
  } & Struct
  readonly isHrmpChannelClosing: boolean
  readonly asHrmpChannelClosing: {
    readonly initiator: Compact<u32>
    readonly sender: Compact<u32>
    readonly recipient: Compact<u32>
  } & Struct
  readonly isClearOrigin: boolean
  readonly isDescendOrigin: boolean
  readonly asDescendOrigin: XcmV4Junctions
  readonly isReportError: boolean
  readonly asReportError: XcmV4QueryResponseInfo
  readonly isDepositAsset: boolean
  readonly asDepositAsset: {
    readonly assets: XcmV4AssetAssetFilter
    readonly beneficiary: XcmV4Location
  } & Struct
  readonly isDepositReserveAsset: boolean
  readonly asDepositReserveAsset: {
    readonly assets: XcmV4AssetAssetFilter
    readonly dest: XcmV4Location
    readonly xcm: XcmV4Xcm
  } & Struct
  readonly isExchangeAsset: boolean
  readonly asExchangeAsset: {
    readonly give: XcmV4AssetAssetFilter
    readonly want: XcmV4AssetAssets
    readonly maximal: bool
  } & Struct
  readonly isInitiateReserveWithdraw: boolean
  readonly asInitiateReserveWithdraw: {
    readonly assets: XcmV4AssetAssetFilter
    readonly reserve: XcmV4Location
    readonly xcm: XcmV4Xcm
  } & Struct
  readonly isInitiateTeleport: boolean
  readonly asInitiateTeleport: {
    readonly assets: XcmV4AssetAssetFilter
    readonly dest: XcmV4Location
    readonly xcm: XcmV4Xcm
  } & Struct
  readonly isReportHolding: boolean
  readonly asReportHolding: {
    readonly responseInfo: XcmV4QueryResponseInfo
    readonly assets: XcmV4AssetAssetFilter
  } & Struct
  readonly isBuyExecution: boolean
  readonly asBuyExecution: {
    readonly fees: XcmV4Asset
    readonly weightLimit: XcmV3WeightLimit
  } & Struct
  readonly isRefundSurplus: boolean
  readonly isSetErrorHandler: boolean
  readonly asSetErrorHandler: XcmV4Xcm
  readonly isSetAppendix: boolean
  readonly asSetAppendix: XcmV4Xcm
  readonly isClearError: boolean
  readonly isClaimAsset: boolean
  readonly asClaimAsset: {
    readonly assets: XcmV4AssetAssets
    readonly ticket: XcmV4Location
  } & Struct
  readonly isTrap: boolean
  readonly asTrap: Compact<u64>
  readonly isSubscribeVersion: boolean
  readonly asSubscribeVersion: {
    readonly queryId: Compact<u64>
    readonly maxResponseWeight: SpWeightsWeightV2Weight
  } & Struct
  readonly isUnsubscribeVersion: boolean
  readonly isBurnAsset: boolean
  readonly asBurnAsset: XcmV4AssetAssets
  readonly isExpectAsset: boolean
  readonly asExpectAsset: XcmV4AssetAssets
  readonly isExpectOrigin: boolean
  readonly asExpectOrigin: Option<XcmV4Location>
  readonly isExpectError: boolean
  readonly asExpectError: Option<ITuple<[u32, XcmV3TraitsError]>>
  readonly isExpectTransactStatus: boolean
  readonly asExpectTransactStatus: XcmV3MaybeErrorCode
  readonly isQueryPallet: boolean
  readonly asQueryPallet: {
    readonly moduleName: Bytes
    readonly responseInfo: XcmV4QueryResponseInfo
  } & Struct
  readonly isExpectPallet: boolean
  readonly asExpectPallet: {
    readonly index: Compact<u32>
    readonly name: Bytes
    readonly moduleName: Bytes
    readonly crateMajor: Compact<u32>
    readonly minCrateMinor: Compact<u32>
  } & Struct
  readonly isReportTransactStatus: boolean
  readonly asReportTransactStatus: XcmV4QueryResponseInfo
  readonly isClearTransactStatus: boolean
  readonly isUniversalOrigin: boolean
  readonly asUniversalOrigin: XcmV4Junction
  readonly isExportMessage: boolean
  readonly asExportMessage: {
    readonly network: XcmV4JunctionNetworkId
    readonly destination: XcmV4Junctions
    readonly xcm: XcmV4Xcm
  } & Struct
  readonly isLockAsset: boolean
  readonly asLockAsset: {
    readonly asset: XcmV4Asset
    readonly unlocker: XcmV4Location
  } & Struct
  readonly isUnlockAsset: boolean
  readonly asUnlockAsset: {
    readonly asset: XcmV4Asset
    readonly target: XcmV4Location
  } & Struct
  readonly isNoteUnlockable: boolean
  readonly asNoteUnlockable: {
    readonly asset: XcmV4Asset
    readonly owner: XcmV4Location
  } & Struct
  readonly isRequestUnlock: boolean
  readonly asRequestUnlock: {
    readonly asset: XcmV4Asset
    readonly locker: XcmV4Location
  } & Struct
  readonly isSetFeesMode: boolean
  readonly asSetFeesMode: {
    readonly jitWithdraw: bool
  } & Struct
  readonly isSetTopic: boolean
  readonly asSetTopic: U8aFixed
  readonly isClearTopic: boolean
  readonly isAliasOrigin: boolean
  readonly asAliasOrigin: XcmV4Location
  readonly isUnpaidExecution: boolean
  readonly asUnpaidExecution: {
    readonly weightLimit: XcmV3WeightLimit
    readonly checkOrigin: Option<XcmV4Location>
  } & Struct
  readonly type:
    | 'WithdrawAsset'
    | 'ReserveAssetDeposited'
    | 'ReceiveTeleportedAsset'
    | 'QueryResponse'
    | 'TransferAsset'
    | 'TransferReserveAsset'
    | 'Transact'
    | 'HrmpNewChannelOpenRequest'
    | 'HrmpChannelAccepted'
    | 'HrmpChannelClosing'
    | 'ClearOrigin'
    | 'DescendOrigin'
    | 'ReportError'
    | 'DepositAsset'
    | 'DepositReserveAsset'
    | 'ExchangeAsset'
    | 'InitiateReserveWithdraw'
    | 'InitiateTeleport'
    | 'ReportHolding'
    | 'BuyExecution'
    | 'RefundSurplus'
    | 'SetErrorHandler'
    | 'SetAppendix'
    | 'ClearError'
    | 'ClaimAsset'
    | 'Trap'
    | 'SubscribeVersion'
    | 'UnsubscribeVersion'
    | 'BurnAsset'
    | 'ExpectAsset'
    | 'ExpectOrigin'
    | 'ExpectError'
    | 'ExpectTransactStatus'
    | 'QueryPallet'
    | 'ExpectPallet'
    | 'ReportTransactStatus'
    | 'ClearTransactStatus'
    | 'UniversalOrigin'
    | 'ExportMessage'
    | 'LockAsset'
    | 'UnlockAsset'
    | 'NoteUnlockable'
    | 'RequestUnlock'
    | 'SetFeesMode'
    | 'SetTopic'
    | 'ClearTopic'
    | 'AliasOrigin'
    | 'UnpaidExecution'
}

/** @name XcmV4AssetAssets (343) */
export interface XcmV4AssetAssets extends Vec<XcmV4Asset> {}

/** @name XcmV4Asset (345) */
interface XcmV4Asset extends Struct {
  readonly id: XcmV4AssetAssetId
  readonly fun: XcmV4AssetFungibility
}

/** @name XcmV4AssetFungibility (346) */
interface XcmV4AssetFungibility extends Enum {
  readonly isFungible: boolean
  readonly asFungible: Compact<u128>
  readonly isNonFungible: boolean
  readonly asNonFungible: XcmV4AssetAssetInstance
  readonly type: 'Fungible' | 'NonFungible'
}

/** @name XcmV4AssetAssetInstance (347) */
interface XcmV4AssetAssetInstance extends Enum {
  readonly isUndefined: boolean
  readonly isIndex: boolean
  readonly asIndex: Compact<u128>
  readonly isArray4: boolean
  readonly asArray4: U8aFixed
  readonly isArray8: boolean
  readonly asArray8: U8aFixed
  readonly isArray16: boolean
  readonly asArray16: U8aFixed
  readonly isArray32: boolean
  readonly asArray32: U8aFixed
  readonly type: 'Undefined' | 'Index' | 'Array4' | 'Array8' | 'Array16' | 'Array32'
}

/** @name XcmV4Response (348) */
interface XcmV4Response extends Enum {
  readonly isNull: boolean
  readonly isAssets: boolean
  readonly asAssets: XcmV4AssetAssets
  readonly isExecutionResult: boolean
  readonly asExecutionResult: Option<ITuple<[u32, XcmV3TraitsError]>>
  readonly isVersion: boolean
  readonly asVersion: u32
  readonly isPalletsInfo: boolean
  readonly asPalletsInfo: Vec<XcmV4PalletInfo>
  readonly isDispatchResult: boolean
  readonly asDispatchResult: XcmV3MaybeErrorCode
  readonly type: 'Null' | 'Assets' | 'ExecutionResult' | 'Version' | 'PalletsInfo' | 'DispatchResult'
}

/** @name XcmV4PalletInfo (350) */
interface XcmV4PalletInfo extends Struct {
  readonly index: Compact<u32>
  readonly name: Bytes
  readonly moduleName: Bytes
  readonly major: Compact<u32>
  readonly minor: Compact<u32>
  readonly patch: Compact<u32>
}

/** @name XcmV4QueryResponseInfo (354) */
interface XcmV4QueryResponseInfo extends Struct {
  readonly destination: XcmV4Location
  readonly queryId: Compact<u64>
  readonly maxWeight: SpWeightsWeightV2Weight
}

/** @name XcmV4AssetAssetFilter (355) */
interface XcmV4AssetAssetFilter extends Enum {
  readonly isDefinite: boolean
  readonly asDefinite: XcmV4AssetAssets
  readonly isWild: boolean
  readonly asWild: XcmV4AssetWildAsset
  readonly type: 'Definite' | 'Wild'
}

/** @name XcmV4AssetWildAsset (356) */
interface XcmV4AssetWildAsset extends Enum {
  readonly isAll: boolean
  readonly isAllOf: boolean
  readonly asAllOf: {
    readonly id: XcmV4AssetAssetId
    readonly fun: XcmV4AssetWildFungibility
  } & Struct
  readonly isAllCounted: boolean
  readonly asAllCounted: Compact<u32>
  readonly isAllOfCounted: boolean
  readonly asAllOfCounted: {
    readonly id: XcmV4AssetAssetId
    readonly fun: XcmV4AssetWildFungibility
    readonly count: Compact<u32>
  } & Struct
  readonly type: 'All' | 'AllOf' | 'AllCounted' | 'AllOfCounted'
}

/** @name XcmV4AssetWildFungibility (357) */
interface XcmV4AssetWildFungibility extends Enum {
  readonly isFungible: boolean
  readonly isNonFungible: boolean
  readonly type: 'Fungible' | 'NonFungible'
}

/** @name XcmV4Location (56) */
export interface XcmV4Location extends Struct {
  readonly parents: u8
  readonly interior: XcmV4Junctions
}

/** @name XcmV4Junctions (57) */
export interface XcmV4Junctions extends Enum {
  readonly isHere: boolean
  readonly isX1: boolean
  readonly asX1: Vec<XcmV4Junction>
  readonly isX2: boolean
  readonly asX2: Vec<XcmV4Junction>
  readonly isX3: boolean
  readonly asX3: Vec<XcmV4Junction>
  readonly isX4: boolean
  readonly asX4: Vec<XcmV4Junction>
  readonly isX5: boolean
  readonly asX5: Vec<XcmV4Junction>
  readonly isX6: boolean
  readonly asX6: Vec<XcmV4Junction>
  readonly isX7: boolean
  readonly asX7: Vec<XcmV4Junction>
  readonly isX8: boolean
  readonly asX8: Vec<XcmV4Junction>
  readonly type: 'Here' | 'X1' | 'X2' | 'X3' | 'X4' | 'X5' | 'X6' | 'X7' | 'X8'
}

/** @name XcmV4Junction (59) */
export interface XcmV4Junction extends Enum {
  readonly isParachain: boolean
  readonly asParachain: Compact<u32>
  readonly isAccountId32: boolean
  readonly asAccountId32: {
    readonly network: Option<XcmV4JunctionNetworkId>
    readonly id: U8aFixed
  } & Struct
  readonly isAccountIndex64: boolean
  readonly asAccountIndex64: {
    readonly network: Option<XcmV4JunctionNetworkId>
    readonly index: Compact<u64>
  } & Struct
  readonly isAccountKey20: boolean
  readonly asAccountKey20: {
    readonly network: Option<XcmV4JunctionNetworkId>
    readonly key: U8aFixed
  } & Struct
  readonly isPalletInstance: boolean
  readonly asPalletInstance: u8
  readonly isGeneralIndex: boolean
  readonly asGeneralIndex: Compact<u128>
  readonly isGeneralKey: boolean
  readonly asGeneralKey: {
    readonly length: u8
    readonly data: U8aFixed
  } & Struct
  readonly isOnlyChild: boolean
  readonly isPlurality: boolean
  readonly asPlurality: {
    readonly id: XcmV3JunctionBodyId
    readonly part: XcmV3JunctionBodyPart
  } & Struct
  readonly isGlobalConsensus: boolean
  readonly asGlobalConsensus: XcmV4JunctionNetworkId
  readonly type:
    | 'Parachain'
    | 'AccountId32'
    | 'AccountIndex64'
    | 'AccountKey20'
    | 'PalletInstance'
    | 'GeneralIndex'
    | 'GeneralKey'
    | 'OnlyChild'
    | 'Plurality'
    | 'GlobalConsensus'
}

/** @name XcmV4JunctionNetworkId (61) */
interface XcmV4JunctionNetworkId extends Enum {
  readonly isByGenesis: boolean
  readonly asByGenesis: U8aFixed
  readonly isByFork: boolean
  readonly asByFork: {
    readonly blockNumber: u64
    readonly blockHash: U8aFixed
  } & Struct
  readonly isPolkadot: boolean
  readonly isKusama: boolean
  readonly isWestend: boolean
  readonly isRococo: boolean
  readonly isWococo: boolean
  readonly isEthereum: boolean
  readonly asEthereum: {
    readonly chainId: Compact<u64>
  } & Struct
  readonly isBitcoinCore: boolean
  readonly isBitcoinCash: boolean
  readonly isPolkadotBulletin: boolean
  readonly type:
    | 'ByGenesis'
    | 'ByFork'
    | 'Polkadot'
    | 'Kusama'
    | 'Westend'
    | 'Rococo'
    | 'Wococo'
    | 'Ethereum'
    | 'BitcoinCore'
    | 'BitcoinCash'
    | 'PolkadotBulletin'
}

/** @name XcmV4AssetAssetId (69) */
interface XcmV4AssetAssetId extends XcmV4Location {}

export interface VersionedInteriorLocation extends Enum {
  readonly isV2: boolean;
  readonly asV2: XcmV2MultilocationJunctions;
  readonly isV3: boolean;
  readonly asV3: XcmV3Junctions;
  readonly isV4: boolean;
  readonly asV4: XcmV4Junctions;
  readonly type: 'V2' | 'V3' | 'V4';
}

export interface BridgeMessage extends Struct {
  readonly universal_dest: VersionedInteriorLocation;
  readonly message: XcmVersionedXcm;
}

export type BridgeMessageAccepted = {
  readonly laneId: BpMessagesLaneId;
  readonly nonce: u64;
} & Struct;

export type BridgeMessagesDelivered = {
  readonly laneId: BpMessagesLaneId;
  readonly messages: BpMessagesDeliveredMessages;
} & Struct;

interface BpMessagesLaneId extends U8aFixed {}

interface BpMessagesDeliveredMessages extends Struct {
  readonly begin: u64;
  readonly end: u64;
}

export interface BpMessagesReceivedMessages extends Struct {
  readonly lane: BpMessagesLaneId;
  readonly receiveResults: Vec<ITuple<[u64, BpMessagesReceivalResult]>>;
}

interface BpMessagesReceivalResult extends Enum {
  readonly isDispatched: boolean;
  readonly asDispatched: BpRuntimeMessagesMessageDispatchResult;
  readonly isInvalidNonce: boolean;
  readonly isTooManyUnrewardedRelayers: boolean;
  readonly isTooManyUnconfirmedMessages: boolean;
  readonly type: 'Dispatched' | 'InvalidNonce' | 'TooManyUnrewardedRelayers' | 'TooManyUnconfirmedMessages';
}

interface BpRuntimeMessagesMessageDispatchResult extends Struct {
  readonly unspentWeight: SpWeightsWeightV2Weight;
  readonly dispatchLevelResult: BridgeRuntimeCommonMessagesXcmExtensionXcmBlobMessageDispatchResult;
}

interface BridgeRuntimeCommonMessagesXcmExtensionXcmBlobMessageDispatchResult extends Enum {
  readonly isInvalidPayload: boolean;
  readonly isDispatched: boolean;
  readonly isNotDispatched: boolean;
  readonly type: 'InvalidPayload' | 'Dispatched' | 'NotDispatched';
}
