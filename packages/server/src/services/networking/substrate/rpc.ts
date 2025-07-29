import { HexString } from '@/lib.js'
import { BlockInfo, ChainSpecData } from './types.js'

const RUNTIME_CODE_KEY = '0x3a636f6465'

export type RpcApi = ReturnType<typeof createRpcApi>

export function createRpcApi(
  chainId: string,
  request: <Reply = any, Params extends Array<any> = any[]>(method: string, params: Params) => Promise<Reply>,
) {
  async function getChainSpecData() {
    try {
      const [name, genesisHash, properties] = await Promise.all([
        request<string>('system_chain', []),
        request<string>('chain_getBlockHash', [0]),
        request<{
          ss58Format?: string | null
          isEthereum: boolean
          tokenSymbol: string[] | string
          tokenDecimals: number[] | number
        }>('system_properties', []),
      ])
      return {
        name,
        genesisHash,
        properties,
      } as ChainSpecData
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to retrieve system properties.`, { cause: error })
    }
  }

  async function getRpcMethods() {
    try {
      return await request<{ methods: string[] }>('rpc_methods', [])
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch RPC methods.`, { cause: error })
    }
  }

  async function getBlock(hash: string) {
    try {
      const result = await request<
        {
          block: {
            header: {
              parentHash: string
              number: string
              stateRoot: string
              extrinsicsRoot: string
              digest?: {
                logs: any[]
              }
            }
            extrinsics: string[]
          }
        },
        [hash: string]
      >('chain_getBlock', [hash])
      return result?.block
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch block body for hash ${hash}.`, {
        cause: error,
      })
    }
  }

  async function getBlockHash(blockNumber: string | number | bigint): Promise<string> {
    try {
      const result = await request<string, [height: string]>('chain_getBlockHash', [
        '0x' + Number(blockNumber).toString(16),
      ])
      if (result === null) {
        throw new Error('Block hash not found')
      }
      return result
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch block hash.`, { cause: error })
    }
  }

  async function getBlockHeader(hash: string): Promise<BlockInfo> {
    try {
      const header = await request<{ parentHash: string; number: string }, [hash: string]>(
        'chain_getHeader',
        [hash],
      )
      return {
        parent: header.parentHash,
        hash,
        number: Number(BigInt(header.number)),
      }
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch header for hash ${hash}.`, { cause: error })
    }
  }

  async function getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey?: string,
    at?: string,
  ): Promise<HexString[]> {
    try {
      return await request<HexString[]>('state_getKeysPaged', [keyPrefix, count, resolvedStartKey, at])
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch storage keys.`, { cause: error })
    }
  }

  async function getStorage(key: string, at?: string) {
    try {
      return await request<HexString>('state_getStorage', [key, at])
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch storage for key ${key}.`, { cause: error })
    }
  }

  async function getRuntimeWasm(at?: string) {
    const wasmHex = await getStorage(RUNTIME_CODE_KEY, at)
    if (!wasmHex) {
      throw new Error(`[client:${chainId}] No runtime code found at key ${RUNTIME_CODE_KEY}`)
    }
    return wasmHex
  }

  async function runtimeCall(functionName: string, callParameters: string = '0x', at?: string) {
    try {
      const params = at ? [functionName, callParameters, at] : [functionName, callParameters]
      return await request<string>('state_call', params)
    } catch (error) {
      throw new Error(
        `[client:${chainId}] Failed to call runtime function ${functionName} with params ${callParameters}.`,
        { cause: error },
      )
    }
  }

  async function getMetadata(at?: string) {
    try {
      return await request<string>('state_getMetadata', [at])
    } catch (error) {
      throw new Error(`[client:${chainId}] Failed to fetch metadata.${at ? ` (${at})` : ''}`, {
        cause: error,
      })
    }
  }

  async function getSpecVersionAt(hash: string): Promise<number> {
    const version = await request<{ specVersion: number }>('state_getRuntimeVersion', [hash])
    if ('specVersion' in version) {
      return version.specVersion
    } else {
      throw new Error(`[client:${chainId}] Unexpected specVersion ${version}`)
    }
  }

  return {
    getChainSpecData,
    getRpcMethods,
    getBlock,
    getBlockHash,
    getBlockHeader,
    getStorage,
    getStorageKeys,
    getMetadata,
    getSpecVersionAt,
    getRuntimeWasm,
    runtimeCall,
  }
}
