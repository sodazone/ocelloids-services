import { decodeEventLog, erc20Abi, Log, zeroAddress } from 'viem'
import { hexToAssetId } from '@/services/agents/common/hydration.js'
import { isEVMLog } from '@/services/networking/substrate/evm/decoder.js'
import { BlockEvmEvent, EventRecordWithIndex } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { MoneyMarketActions } from '../../../types.js'
import { ASSET_ID_MAP } from '../consts.js'
import { HydrationLendingEvent, HydrationLiquidationEvent } from './types.js'

type AaveSupplyEventArgs = {
  reserve: HexString
  user: HexString
  onBehalfOf: HexString
  amount: bigint
  referralCode: number
}

type AaveWithdrawEventArgs = {
  reserve: HexString
  user: HexString
  to: HexString
  amount: bigint
}

type AaveBorrowEventArgs = {
  reserve: HexString
  user: HexString
  onBehalfOf: HexString
  amount: bigint
  interestRateMode: number
  borrowRate: bigint
  referralCode: number
}

type AaveRepayEventArgs = {
  reserve: HexString
  user: HexString
  repayer: HexString
  amount: bigint
  useATokens: boolean
}

type AaveLiquidationCallEventArgs = {
  collateralAsset: HexString
  debtAsset: HexString
  user: HexString
  debtToCover: bigint
  liquidatedCollateralAmount: bigint
  liquidator: HexString
  receiveAToken: boolean
}

function toLendingEvent(
  event: BlockEvmEvent,
  {
    action,
    assetAddress,
    user,
    amount,
  }: { action: MoneyMarketActions; assetAddress: HexString; user: HexString; amount: bigint },
): HydrationLendingEvent | null {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, timestamp, address } = event
  const asset = ASSET_ID_MAP.get(assetAddress) ?? hexToAssetId(assetAddress)
  if (!asset) {
    throw new Error(`Unable to map reserve asset address to asset id: ${assetAddress}`)
  }

  return {
    type: 'lending',
    action,
    protocol: 'aave',
    blockNumber,
    blockHash,
    marketId: address.toLowerCase(),
    who: user,
    event: {
      blockPosition,
      module,
      name,
    },
    amount,
    asset,
    timestamp,
    extrinsic: extrinsic
      ? {
          method: extrinsic.method,
          module: extrinsic.module,
          txHash: extrinsic.hash,
          evmTxHash: extrinsic.evmTxHash,
        }
      : undefined,
  }
}

export function aaveBorrowHandler(
  event: BlockEvmEvent,
  _siblings: EventRecordWithIndex[],
): HydrationLendingEvent | null {
  const { decoded } = event
  if (!decoded) {
    return null
  }
  const { amount, reserve, onBehalfOf } = decoded.args as AaveBorrowEventArgs
  return toLendingEvent(event, {
    action: 'borrow',
    amount,
    assetAddress: reserve,
    user: onBehalfOf,
  })
}

export function aaveSupplyHandler(
  event: BlockEvmEvent,
  _siblings: EventRecordWithIndex[],
): HydrationLendingEvent | null {
  const { decoded } = event
  if (!decoded) {
    return null
  }
  const { amount, reserve, onBehalfOf } = decoded.args as AaveSupplyEventArgs

  return toLendingEvent(event, {
    action: 'supply',
    amount,
    assetAddress: reserve,
    user: onBehalfOf,
  })
}

export function aaveWithdrawHandler(
  event: BlockEvmEvent,
  _siblings: EventRecordWithIndex[],
): HydrationLendingEvent | null {
  const { decoded } = event
  if (!decoded) {
    return null
  }
  const { amount, reserve, to } = decoded.args as AaveWithdrawEventArgs

  return toLendingEvent(event, {
    action: 'withdraw',
    amount,
    assetAddress: reserve,
    user: to,
  })
}

export function aaveRepayHandler(
  event: BlockEvmEvent,
  siblings: EventRecordWithIndex[],
): HydrationLendingEvent | null {
  const { decoded } = event
  if (!decoded) {
    return null
  }
  const { amount, reserve, repayer, useATokens } = decoded.args as AaveRepayEventArgs

  if (useATokens) {
    const siblingLogs = siblings.filter((e) => isEVMLog(e.event)).map((e) => e.event.value.log as Log)
    const tokenBurns = siblingLogs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: erc20Abi,
            topics: log.topics,
            data: log.data,
            eventName: 'Transfer',
          })
          return {
            ...decoded.args,
            token: log.address,
          }
        } catch (_e) {
          return null
        }
      })
      .filter((tf) => tf !== null)
      .filter((tf) => tf.to === zeroAddress)

    console.log('repay using atokens token burn events', tokenBurns)
  }

  return toLendingEvent(event, {
    action: 'repay',
    amount,
    assetAddress: reserve,
    user: repayer,
  })
}

export function aaveLiquidationHandler(
  event: BlockEvmEvent,
  _siblings: EventRecordWithIndex[],
): HydrationLiquidationEvent | null {
  const { decoded } = event
  if (!decoded) {
    return null
  }
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, timestamp, address } = event
  const { collateralAsset, debtAsset, debtToCover, liquidatedCollateralAmount, liquidator, user } =
    decoded.args as AaveLiquidationCallEventArgs

  const collateralId = ASSET_ID_MAP.get(collateralAsset) ?? hexToAssetId(collateralAsset)
  const debtId = ASSET_ID_MAP.get(debtAsset) ?? hexToAssetId(debtAsset)
  if (!collateralId || !debtId) {
    throw new Error(
      `Unable to map asset address to asset id: ${collateralId === null ? collateralAsset : debtAsset}`,
    )
  }

  return {
    type: 'liquidation',
    protocol: 'aave',
    blockNumber,
    blockHash,
    marketId: address.toLowerCase(),
    who: liquidator,
    counterparty: user,
    event: {
      blockPosition,
      module,
      name,
    },
    collateralAsset: collateralId,
    collateralLiquidated: liquidatedCollateralAmount,
    debtAsset: debtId,
    debtCovered: debtToCover,
    timestamp,
    extrinsic: extrinsic
      ? {
          method: extrinsic.method,
          module: extrinsic.module,
          txHash: extrinsic.hash,
          evmTxHash: extrinsic.evmTxHash,
        }
      : undefined,
  }
}
