import { hexToAssetId } from '@/services/agents/common/hydration.js'
import { BlockEvmEvent } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { ASSET_ID_MAP } from '../consts.js'
import { EventRecordWithIndex, HydrationLendingEvent } from './types.js'

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

export function aaveBorrowHandler(
  event: BlockEvmEvent,
  siblings: EventRecordWithIndex[],
): HydrationLendingEvent | null {
  const { blockHash, blockNumber, blockPosition, module, name, extrinsic, timestamp, decoded, address } =
    event
  if (!decoded) {
    return null
  }
  const { amount, reserve, user } = decoded.args as AaveBorrowEventArgs
  const asset = ASSET_ID_MAP.get(reserve) ?? hexToAssetId(reserve)
  console.log('AAVE BORROW ---', decoded.args, asset)
  if (!asset) {
    throw new Error(`Unable to map reserve asset address to asset id: ${reserve}`)
  }

  return {
    type: 'lending',
    action: 'borrow',
    blockNumber,
    blockHash,
    marketId: address,
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
