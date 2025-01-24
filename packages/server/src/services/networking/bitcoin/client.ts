import { distinctUntilChanged, from, mergeMap, shareReplay, timer } from 'rxjs'

import { clearTimeout } from 'timers'
import { Logger } from '../../types.js'
import { ApiClient } from '../types.js'
import { Block, BlockHeader, ChainInfo } from './types.js'

export const RPCs = {
  mainnet: [
    'https://bitcoin.drpc.org/',
    'https://bitcoin-rpc.publicnode.com',
    'https://bitcoin-mainnet.public.blastapi.io/',
  ],
  testnet: [
    'https://bitcoin-testnet.drpc.org/',
    'https://bitcoin-testnet-rpc.publicnode.com',
    'https://bitcoin-testnet.public.blastapi.io/',
  ],
}

export class RpcError extends Error {
  code: number

  constructor(error: RpcReponseError | null) {
    super(error?.message)

    this.code = error?.code ?? 0
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

type RpcReponseError = {
  code: number
  message: string
}

type RpcResponse<T> = {
  result: null | T
  error: null | RpcReponseError
  id: string
}

async function parseBody<T>(
  response: Response,
  opts?: {
    signal?: AbortSignal
    maxBodyBytes: number
  },
): Promise<RpcResponse<T>> {
  const { maxBodyBytes, signal } = opts ?? {}
  if (response.body) {
    let bytes = 0
    const chunks = []
    for await (const chunk of response.body) {
      if (signal?.aborted) {
        break
      }
      bytes += chunk.length
      if (maxBodyBytes && bytes > maxBodyBytes) {
        throw new Error(`Maximum body bytes ${maxBodyBytes}`)
      }
      chunks.push(chunk)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as RpcResponse<T>
  } else {
    throw new Error('Empty body')
  }
}

export class BitcoinApi implements ApiClient {
  readonly chainId: string

  #id
  #urlIndex: number

  readonly #log
  readonly #controller
  readonly #signal

  readonly #delay: number
  readonly #maxRetries: number
  readonly #timeout: number
  readonly #urls: string[]
  readonly #maxBodyBytes: number

  constructor(log: Logger, chainId: string, url: string | string[]) {
    this.chainId = chainId

    this.#log = log

    this.#id = 0
    this.#urlIndex = 0

    this.#maxRetries = 5
    this.#timeout = 10_000
    this.#delay = 1_000
    this.#maxBodyBytes = 5_242_880

    this.#controller = new AbortController()
    this.#signal = this.#controller.signal

    this.#urls = Array.isArray(url) ? url : [url]
  }

  followHeads$ = timer(0, 60_000).pipe(
    mergeMap(() => from(this.getBlockHeight())),
    distinctUntilChanged(),
    mergeMap(async (height) => {
      const newHeight = height
      const hash = await this.getBlockHash(newHeight)
      return await this.getNeutralBlockHeader(hash)
    }),
    shareReplay(1),
  )

  async getBlockHeight() {
    return await this.#call<number>('getblockcount')
  }

  async getBlockHash(height: number) {
    return await this.#call<string>('getblockhash', [height])
  }

  async getBlockHeader(hash: string) {
    return await this.#call<BlockHeader>('getblockheader', [hash])
  }

  async getNeutralBlockHeader(hash: string) {
    const header = await this.getBlockHeader(hash)
    return {
      parenthash: header.previousblockhash,
      hash: header.hash,
      height: header.height,
    }
  }

  async getBlock(hash: string) {
    return await this.#call<Block>('getblock', [hash])
  }

  async getBestBlock() {
    const blockHash = await this.#call<string>('getbestblockhash')
    return await this.getBlock(blockHash)
  }

  async getNetworkInfo() {
    return await this.#call<ChainInfo>('getblockchaininfo')
  }

  connect() {
    return Promise.resolve(this)
  }

  disconnect() {
    this.#controller.abort('disconnected')
  }

  async #call<T>(method: string, params: (string | number)[] = []): Promise<T> {
    const body = {
      jsonrpc: '1.0',
      id: this.#id++,
      method,
      params,
    }

    const fetchWithRety = async (attempt = 0): Promise<Response> => {
      try {
        let timeout: NodeJS.Timeout | undefined

        const response = (await Promise.race([
          fetch(this.#url, {
            body: JSON.stringify(body),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            method: 'POST',
            signal: this.#signal,
          }),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Timeout')), this.#timeout).unref()
          }),
        ])) as Response

        clearTimeout(timeout)

        if (response.ok) {
          return response
        }

        throw new RpcError((await parseBody(response)).error)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (attempt < this.#maxRetries && (message === 'Timeout' || message === 'Network request failed')) {
          return retry(attempt, this.#delay)
        } else {
          throw error
        }
      }
    }

    function retry(attempt: number, delay: number) {
      console.log('retrying', attempt, delay)
      return new Promise<Response>((resolve, reject) =>
        setTimeout(() => {
          fetchWithRety(attempt + 1)
            .then(resolve)
            .catch(reject)
        }, delay),
      )
    }

    const response = await fetchWithRety()
    return (
      await parseBody<T>(response, {
        signal: this.#signal,
        maxBodyBytes: this.#maxBodyBytes,
      })
    ).result!
  }

  get #url() {
    if (this.#urlIndex >= this.#urls.length) {
      this.#urlIndex = 0
    }
    return this.#urls[this.#urlIndex++]
  }
}

//const client = new BitcoinApi({} as unknown as Logger, 'test', RPCs.testnet)
//console.log(await client.getBestBlock())
