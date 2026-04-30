import { formatUnits, parseAbi } from 'viem'
import { HexString, NetworkURN } from '@/lib.js'
import { EvmIngressConsumer } from '@/services/networking/evm/ingress/types.js'
import { Market } from './types.js'

const mTokenAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function supplyRatePerTimestamp() view returns (uint256)',
  'function borrowRatePerTimestamp() view returns (uint256)',
  'function exchangeRateStored() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function getCash() view returns (uint256)',
  'function totalReserves() view returns (uint256)',
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
  ) {
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
    })

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
    const totalUnderlyingSupply = (totalSupply * exchangeRate) / BigInt(1e18) // What is owed to users
    const totalAssets = cash + totalBorrows // What the protocol actually holds/is owed

    // Solvency
    // Note: totalReserves is protocol equity; technically the system is solvent
    // even if it consumes reserves, but "Pure Solvency" checks Assets vs Liabilities.
    const badDebtUnderlying = totalUnderlyingSupply > totalAssets ? totalUnderlyingSupply - totalAssets : 0n

    const solvencyRatio =
      totalUnderlyingSupply > 0n ? (Number(totalAssets) / Number(totalUnderlyingSupply)) * 100 : 100

    const tvlUSD = Number(formatUnits(totalUnderlyingSupply, underlying.decimals)) * priceUSDNum
    const borrowsUSD = Number(formatUnits(totalBorrows, underlying.decimals)) * priceUSDNum
    const cashUSD = Number(formatUnits(cash, underlying.decimals)) * priceUSDNum
    const reservesUSD = Number(formatUnits(totalReserves, underlying.decimals)) * priceUSDNum
    const badDebtUSD = Number(formatUnits(badDebtUnderlying, underlying.decimals)) * priceUSDNum

    // Calculate Real Liquidity (What is actually available for user withdrawals)
    // Cash is physical tokens. Reserves belong to the protocol.
    const realAvailableUnderlying = cash > totalReserves ? cash - totalReserves : 0n

    // Calculate the Withdrawal Gap (How much is missing to pay all suppliers)
    // If this is > 0, the market is a "Liquidity Trap"
    const withdrawalShortfallUnderlying =
      totalUnderlyingSupply > realAvailableUnderlying ? totalUnderlyingSupply - realAvailableUnderlying : 0n

    const realLiquidityUSD = Number(formatUnits(realAvailableUnderlying, underlying.decimals)) * priceUSDNum
    const shortfallUSD = Number(formatUnits(withdrawalShortfallUnderlying, underlying.decimals)) * priceUSDNum

    return {
      chainId,
      market: { mToken, underlying },
      rates: {
        supply: data[0].result,
        borrow: data[1].result,
      },
      stats: {
        totalSupply,
        totalUnderlyingSupply,
        totalBorrows,
        totalReserves,
        cash,
        badDebtUnderlying,
      },
      prices: {
        raw: price,
        usd: priceUSDNum,
      },
      valuation: {
        tvlUSD,
        borrowsUSD,
        cashUSD,
        realLiquidityUSD,
        shortfallUSD,
        equityUSD: reservesUSD,
        badDebtUSD,
      },
      health: {
        solvencyRatio,
        isSolvent: totalAssets >= totalUnderlyingSupply,
        exitLiquidityRatio:
          totalUnderlyingSupply > 0n
            ? (Number(realAvailableUnderlying) / Number(totalUnderlyingSupply)) * 100
            : 100,
        utilizationRate:
          totalUnderlyingSupply > 0n ? (Number(totalBorrows) / Number(totalUnderlyingSupply)) * 100 : 0,
      },
      status: {
        mintPaused: isMintPaused,
        borrowPaused: isBorrowPaused,
        isFrozen: isMintPaused && isBorrowPaused,
        borrowCap: borrowCap,
        label: isMintPaused && isBorrowPaused ? 'FROZEN' : isMintPaused ? 'REDEEM_ONLY' : 'ACTIVE',
      },
    }
  }
  return { getMarketData }
}
