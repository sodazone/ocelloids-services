import { Observable, map, mergeMap } from 'rxjs'

import { http, createPublicClient, erc20Abi, fallback, getAddress, getContract } from 'viem'
import { moonbeam } from 'viem/chains'

import { HexString } from '@/lib.js'
import { AssetMetadata, StorageCodecs, WithRequired, networks } from './types.js'
import { toPaddedHex } from './util.js'

const client = createPublicClient({
  chain: moonbeam,
  transport: fallback([
    http('https://moonbeam-rpc.dwellir.com'),
    http('https://moonbeam.api.onfinality.io/public'),
    http('https://moonbeam.unitedbloc.com'),
    http('https://moonbeam.public.curie.radiumblock.co/http'),
    http('https://moonbeam.public.blastapi.io'),
    http('https://1rpc.io/glmr'),
  ]),
})

async function getErc20Metadata(address: HexString) {
  const contract = getContract({
    address: getAddress(address),
    abi: erc20Abi,
    client: client,
  })
  const metadata = await Promise.all([contract.read.name(), contract.read.symbol(), contract.read.decimals()])
  return {
    name: metadata[0],
    symbol: metadata[1],
    decimals: metadata[2],
  }
}

export const mapAssetsLocationsAndErc20Metadata = (codec: WithRequired<StorageCodecs, 'locations'>) => {
  return (keyArgs: string) => {
    return (source: Observable<HexString>): Observable<AssetMetadata> => {
      return source.pipe(
        mergeMap((buffer) => {
          const assetId = codec.locations.value.dec(buffer)
          const precompileAddress = toPaddedHex(assetId)
          return Promise.all([
            getErc20Metadata(precompileAddress),
            Promise.resolve(assetId),
            Promise.resolve(buffer),
          ])
        }),
        map(([erc20, assetId, xid]) => {
          const multiLocation = codec.locations.keys.dec(keyArgs)[0]
          const assetMetadata: AssetMetadata = {
            chainId: networks.moonbeam,
            externalIds: [],
            id: assetId.toString(),
            xid,
            decimals: erc20.decimals,
            name: erc20.name,
            symbol: erc20.symbol,
            updated: Date.now(),
            raw: {},
            multiLocation,
          }
          return assetMetadata
        }),
      )
    }
  }
}
