import { TickerPriceData } from '../types.js'

export interface PriceScout {
  get source(): string
  fetchPrices(tickers: string[]): Promise<TickerPriceData[]>
}
