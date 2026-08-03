import { formatUnits, parseAbi } from 'viem'
import { HexString, NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { DefiLiquidityPayload } from '../../types.js'
import { Market } from './types.js'

export const mTokenAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function supplyRatePerTimestamp() view returns (uint256)',
  'function borrowRatePerTimestamp() view returns (uint256)',
  'function exchangeRateStored() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function getCash() view returns (uint256)',
  'function totalReserves() view returns (uint256)',
  'event Mint(address minter, uint256 mintAmount, uint256 mintTokens)',
  'event Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens)',
  'event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)',
  'event RepayBorrow(address payer, address borrower, uint256 repayAmount, uint256 accountBorrows, uint256 totalBorrows)',
  'event LiquidateBorrow(address liquidator, address borrower, uint256 repayAmount, address mTokenCollateral, uint256 seizeTokens)',
  'event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows)',
])

const oracleAbi = parseAbi(['function getUnderlyingPrice(address mToken) view returns (uint256)'])

const comptrollerAbi = parseAbi([
  'function mintGuardianPaused(address mToken) view returns (bool)',
  'function borrowGuardianPaused(address mToken) view returns (bool)',
  'function borrowCaps(address mToken) view returns (uint256)',
  'function supplyCaps(address mToken) view returns (uint256)',
  'function oracle() view returns (address)',
])

export function createMoonwellDataFetcher(chainId: NetworkURN, client: EvmIngressConsumer) {
  async function getMarketData(
    { mToken, underlying }: Market,
    oracleAddress: HexString,
    comptrollerAddress: HexString,
    blockNumber?: bigint,
  ): Promise<DefiLiquidityPayload> {
    const mTokenAddress = mToken.address
    const data = await client.multicall(chainId, {
      contracts: [
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'supplyRatePerTimestamp' },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'borrowRatePerTimestamp' },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'exchangeRateStored' },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'totalSupply' },
        { address: oracleAddress, abi: oracleAbi, functionName: 'getUnderlyingPrice', args: [mTokenAddress] },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'totalBorrows' },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'getCash' },
        { address: mTokenAddress, abi: mTokenAbi, functionName: 'totalReserves' },
        {
          address: comptrollerAddress,
          abi: comptrollerAbi,
          functionName: 'mintGuardianPaused',
          args: [mTokenAddress],
        },
        {
          address: comptrollerAddress,
          abi: comptrollerAbi,
          functionName: 'borrowGuardianPaused',
          args: [mTokenAddress],
        },
        {
          address: comptrollerAddress,
          abi: comptrollerAbi,
          functionName: 'borrowCaps',
          args: [mTokenAddress],
        },
      ],
      blockNumber,
    })

    const supplyRate = data[0].result as bigint
    const borrowRate = data[1].result as bigint
    const exchangeRate = data[2].result as bigint
    const totalSupply = data[3].result as bigint
    const price = data[4].result as bigint
    const totalBorrows = data[5].result as bigint
    const cash = data[6].result as bigint
    const totalReserves = data[7].result as bigint

    const isMintPaused = data[8].result as boolean
    const isBorrowPaused = data[9].result as boolean
    const borrowCap = data[10].result as bigint

    const priceUSDNum = Number(formatUnits(price, 36 - underlying.decimals))
    const totalUnderlyingSupply = (totalSupply * exchangeRate) / BigInt(1e18)
    const suppliedUSD = Number(formatUnits(totalUnderlyingSupply, underlying.decimals)) * priceUSDNum

    const totalPoolLiquidity = cash + totalBorrows - totalReserves
    const utilization = totalPoolLiquidity > 0n ? Number(totalBorrows) / Number(totalPoolLiquidity) : 0
    const borrowedUSD = Number(formatUnits(totalBorrows, underlying.decimals)) * priceUSDNum

    // Interest APR Scaling
    const SECONDS_PER_YEAR = 31_536_000n
    const supplyAPR = (Number(supplyRate) / 1e18) * Number(SECONDS_PER_YEAR) * 100
    const borrowAPR = (Number(borrowRate) / 1e18) * Number(SECONDS_PER_YEAR) * 100

    const totalProtocolAssets = cash + totalBorrows
    const totalProtocolLiabilities = totalUnderlyingSupply + totalReserves

    const solvencyRatio =
      totalProtocolLiabilities > 0n ? Number(totalProtocolAssets) / Number(totalProtocolLiabilities) : 1

    const deficitUnderlying =
      totalProtocolLiabilities > totalProtocolAssets ? totalProtocolLiabilities - totalProtocolAssets : 0n
    const tokenDeficitUSD = Number(formatUnits(deficitUnderlying, underlying.decimals)) * priceUSDNum

    return {
      type: 'liquidity',
      category: 'money-market',
      protocol: 'moonwell',
      networkId: chainId,
      marketId: mTokenAddress,
      suppliedUSD,
      assets: [
        {
          assetId: underlying.address,
          symbol: underlying.symbol,
          decimals: underlying.decimals,
          priceUSD: priceUSDNum,
          balances: {
            total: formatUnits(totalProtocolLiabilities, underlying.decimals),
            available: formatUnits(cash, underlying.decimals),
            borrowed: formatUnits(totalBorrows, underlying.decimals),
            reserves: formatUnits(totalProtocolAssets, underlying.decimals),
          },
        },
      ],
      lending: {
        utilization,
        supplyAPR,
        borrowAPR,
        isPaused: isMintPaused || isBorrowPaused,
        canBorrow: !isBorrowPaused,
        borrowedUSD,
        borrowCap: formatUnits(borrowCap, underlying.decimals),
        health: {
          solvencyRatio,
          tokenDeficitUSD,
        },
      },
    }
  }
  return { getMarketData }
}
