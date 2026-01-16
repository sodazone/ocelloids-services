import { TickerPriceData } from '../types.js'
import { PriceScout } from './interface.js'

const ENDPOINT = 'https://www.okx.com'

type IndexTickerData = {
  instId: string
  idxPx: string
  high24h: string
  sodUtc0: string
  open24h: string
  low24h: string
  sodUtc8: string
  ts: string
}

export class OkxPriceScout implements PriceScout {
  private readonly quoteCurrency = 'USD'

  get source(): string {
    return 'okx'
  }

  async fetchPrices(tickers: string[]): Promise<TickerPriceData[]> {
    const symbols = tickers.map((t) => `${t}-${this.quoteCurrency}`.toLowerCase())

    const response = await fetch(`${ENDPOINT}/api/v5/market/index-tickers?quoteCcy=${this.quoteCurrency}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch OKX prices.`)
    }
    const results = (await response.json()) as { code: string; msg: string; data: IndexTickerData[] }

    return results.data
      .filter((result) => symbols.includes(result.instId.toLowerCase()))
      .map(({ idxPx, instId }) => {
        return {
          ticker: this.#getTickerFromSymbol(instId),
          price: parseFloat(idxPx),
          source: this.source,
          updated: Date.now(),
        } as TickerPriceData
      })
  }

  #getTickerFromSymbol(symbol: string): string {
    return symbol.replace(`-${this.quoteCurrency}`, '')
  }
}
