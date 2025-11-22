import ky, { Options } from 'ky'

export type FetcherOptions = Options
export function createFetcher(options?: FetcherOptions) {
  return ky.create(options)
}
