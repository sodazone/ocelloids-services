import { distinctUntilChanged, from, map, mergeMap, shareReplay, timer } from 'rxjs'

import { ApiClient } from '../types.js'
import { Block, ChainInfo } from './types.js'

// TODO roundobin by providr..
const RPC = 'https://bitcoin-rpc.publicnode.com'

type RpcResponse<T> = {
  result: T
  error: null | string
  id: string
}

export class BitcoinApi implements ApiClient {
  readonly chainId: string

  readonly #controller
  readonly #signal
  #id

  constructor(chainId: string) {
    this.chainId = chainId

    this.#id = 0
    this.#controller = new AbortController()
    this.#signal = this.#controller.signal
  }

  // TODO handle re-orgs in watcher
  follow$ = timer(0, 60_000).pipe(
    mergeMap(() => from(this.#call<RpcResponse<number>>('getblockcount')).pipe(map((r) => r.result))),
    distinctUntilChanged(),
    mergeMap(async (height) => {
      //if (this.currentHeight <= height) {
      const newHeight = height
      const currentHash = await this.getBlockHash(newHeight)
      const currentBlock = await this.getBlock(currentHash)
      return currentBlock

      // TODO get from db and calc gap of reorg
      //}
    }),
    shareReplay(1),
  )

  async getBlockHash(height: number) {
    return (await this.#call<RpcResponse<string>>('getblockhash', [height])).result
  }

  async getBlock(hash: string) {
    return (await this.#call<RpcResponse<Block>>('getblock', [hash])).result
  }

  async getBestBlock() {
    const blockHash = (await this.#call<RpcResponse<string>>('getbestblockhash')).result
    return await this.getBlock(blockHash)
  }

  async getChainInfo() {
    return (await this.#call<RpcResponse<ChainInfo>>('getblockchaininfo')).result
  }

  connect() {
    return Promise.resolve(this)
  }
  disconnect() {
    // stateless
  }

  async #call<R>(method: string, params: (string | number)[] = []): Promise<R> {
    const body = {
      jsonrpc: '1.0',
      id: this.#id++,
      method,
      params,
    }

    const retries = 2

    const fetchWithRety = async (attempt = 0): Promise<Response> => {
      try {
        const response = await fetch(RPC, {
          body: JSON.stringify(body),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: this.#signal,
        })

        if (response.ok) {
          return response
        }

        if (attempt < retries) {
          // TODO decode body error...
          return retry(attempt, null, response)
        } else {
          return response
        }
      } catch (e) {
        if (attempt < retries) {
          return retry(attempt, e as Error)
        } else {
          throw e
        }
      }
    }

    function retry(attempt: number, _error: Error | null, _response?: Response) {
      const delay = 1_000
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
    if (response.body) {
      let _bytes = 0
      const chunks = []
      for await (const chunk of response.body) {
        if (this.#signal.aborted) {
          break
        }
        _bytes += chunk.length
        // TODO if more than max bytes throw!
        chunks.push(chunk)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as R
    } else {
      throw new Error('empty')
    }
  }
}

const client = new BitcoinApi('test')
client.follow$.subscribe((block) => {
  console.log(0.001 * block.size, 'KB')
  console.log(0.001 * block.weight, 'KWU')
  console.log(
    `Block: #${block.height} ${block.hash} (${new Date(block.time * 1000)}, ${block.confirmations} / ${block.mediantime} TX:${block.nTx} / parent:${block.previousblockhash})`,
  )
})
