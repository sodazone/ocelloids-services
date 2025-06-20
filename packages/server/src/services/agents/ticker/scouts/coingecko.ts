import { TickerPriceData } from '../types.js'
import { PriceScout } from './interface.js'

type CGMarketData = {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number | null
  fully_diluted_valuation: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  atl_change_percentage: number
  atl_date: string
  roi: number | null
  last_updated: string
}

const CG_ID_MAP: Record<string, string> = {
  DOT: 'polkadot',
  ETH: 'ethereum',
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
  DAI: 'dai',
  TBTC: 'tbtc',
  LINK: 'chainlink',
  SKY: 'sky',
  LDO: 'lido-dao',
  AAVE: 'aave',
  LBTC: 'lombard-staked-btc',
  GLMR: 'moonbeam',
  ASTR: 'astar',
  ACA: 'aca',
  ASEED: 'ausd-seed-acala',
  BNC: 'bifrost-native-coin',
  HDX: 'hydradx',
  MYTH: 'mythos',
  CFG: 'centrifuge',
  PHA: 'pha',
  USDT: 'tether',
  USDC: 'usd-coin',
  VDOT: 'voucher-dot',
  VASTR: 'bifrost-voucher-astr',
  VGLMR: 'voucher-glmr',
  VMANTA: 'bifrost-voucher-manta',
  MANTA: 'manta-network',
  KSM: 'kusama',
  SOL: 'solana',
  IBTC: 'interbtc',
  INTR: 'interlay'
}

const ENDPOINT = 'https://api.coingecko.com/api/v3'

export class CoinGeckoPriceScout implements PriceScout {
  get source(): string {
    return 'coingecko'
  }

  async fetchPrices(tickers: string[]): Promise<TickerPriceData[]> {
    const ids = tickers.map((ticker) => CG_ID_MAP[ticker.toUpperCase()] || ticker.toLowerCase())

    if (ids.length === 0) {
      throw new Error('No valid CoinGecko IDs found for the provided tickers')
    }
    const url = `${ENDPOINT}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids.join(','))}`

    if (!process.env.OC_CG_API_KEY) {
      throw new Error('CoinGecko API key not configured')
    }
    const response = await fetch(url, {
      headers: {
        'x-cg-demo-api-key': process.env.OC_CG_API_KEY,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch prices from CoinGecko. Reason: ${await response.text()}`)
    }

    const data = await response.json()

    return data.map((coin: CGMarketData) => {
      const { current_price, symbol, last_updated } = coin

      return {
        ticker: symbol.toUpperCase(),
        price: current_price,
        source: this.source,
        updated: Date.parse(last_updated),
      } as TickerPriceData
    })
  }
}
