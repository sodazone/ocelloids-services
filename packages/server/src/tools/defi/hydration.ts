import { Abi } from 'viem'
import { EvmLocalConsumer } from '@/services/networking/evm/ingress/local.js'
import { HexString } from '@/services/subscriptions/types.js'
import aaveDataProviderAbi from './aave_data_provider.json' with { type: 'json' }
import { initRuntime } from './ctx.js'

type AaveReservesDataResponse = {
  underlyingAsset: HexString
  aTokenAddress: HexString
  decimals: bigint
  symbol: string
  availableLiquidity: bigint
  totalPrincipalStableDebt: bigint
  totalScaledVariableDebt: bigint
  priceInMarketReferenceCurrency: bigint
  variableBorrowRate: bigint
  liquidityRate: bigint
  variableBorrowIndex: bigint
  borrowCap: bigint
  supplyCap: bigint
  accruedToTreasury: bigint
  unbacked: bigint
  isPaused: boolean
  borrowingEnabled: boolean
}[]

type AaveBaseCurrencyData = {
  marketReferenceCurrencyUnit: bigint
  marketReferenceCurrencyPriceInUsd: bigint
  networkBaseTokenPriceInUsd: bigint
  networkBaseTokenPriceDecimals: number
}

export const AaveV3HydrationMainnet = {
  POOL_ADDRESSES_PROVIDER: '0x3C7D7b74bB625736b93d859e332F06Df64635973', // gigahdx provider
  POOL: '0x1b02E051683b5cfaC5929C25E84adb26ECf87B38',
  WETH_GATEWAY: '',
  FAUCET: '',
  WALLET_BALANCE_PROVIDER: '0x0AFCD36f29BbC1Ae40007ff289901Ae442558796',
  UI_POOL_DATA_PROVIDER: '0x112b087b60C1a166130d59266363C45F8aa99db0',
  UI_INCENTIVE_DATA_PROVIDER: '0x23711ED88aFd7C9930a7337e5AacA3DAcC780FEc',
  GHO_TOKEN_ADDRESS: '',
  GHO_UI_DATA_PROVIDER: '',
  COLLECTOR: '0xE52567fF06aCd6CBe7BA94dc777a3126e180B6d9',
}

const { services } = initRuntime()

const consumer = new EvmLocalConsumer(services)

await consumer.start()

const aaveReservesResponse = await consumer.readContract<[AaveReservesDataResponse, AaveBaseCurrencyData]>(
  'urn:ocn:ethereum:222222',
  {
    address: AaveV3HydrationMainnet.UI_POOL_DATA_PROVIDER as HexString,
    abi: aaveDataProviderAbi as Abi,
    functionName: 'getReservesData',
    args: [AaveV3HydrationMainnet.POOL_ADDRESSES_PROVIDER],
  },
)

const aaveReservesData = aaveReservesResponse[0]

for (const { underlyingAsset, symbol, decimals, aTokenAddress } of aaveReservesData) {
  console.log(symbol, underlyingAsset, aTokenAddress, decimals)
}
