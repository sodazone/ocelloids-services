import { TickerPriceData } from '../types.js'
import { PriceScout } from './interface.js'

const ENDPOINT = 'https://data-api.binance.vision'

export class BinancePriceScout implements PriceScout {
  private readonly quoteCurrency = 'USDT'

  get source(): string {
    return 'binance'
  }

  async fetchPrices(tickers: string[]): Promise<TickerPriceData[]> {
    const symbols = tickers.map((t) => `${t}${this.quoteCurrency}`)
    const requests = symbols.map((symbol) =>
      fetch(`${ENDPOINT}/api/v3/ticker/price?symbol=${symbol}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch price for ${symbol}`)
          }
          return response.json()
        })
        .then((data) => ({ symbol, price: parseFloat(data.price) })),
    )

    const results = await Promise.allSettled(requests)

    return results
      .filter((result) => result.status === 'fulfilled')
      .map(({ value }) => {
        return {
          ticker: this.#getTickerFromSymbol(value.symbol),
          price: value.price,
          source: this.source,
          updated: Date.now(),
        } as TickerPriceData
      })
  }

  #getTickerFromSymbol(symbol: string): string {
    return symbol.replace(this.quoteCurrency, '')
  }
}
