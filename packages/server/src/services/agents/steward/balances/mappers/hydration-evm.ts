import { asPublicKey, isEVMAddress } from '@/common/util.js'
import { HexString, NetworkURN } from '@/lib.js'
import { isEVMLog } from '@/services/networking/substrate/evm/decoder.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { fromBufferToBase58 } from '@polkadot-api/substrate-bindings'
import { Binary } from 'polkadot-api'
import { fromHex, toHex } from 'polkadot-api/utils'
import { EMPTY, Observable, filter, firstValueFrom, from, map, mergeMap, switchMap } from 'rxjs'
import { assetMetadataKey, assetMetadataKeyHash } from '../../util.js'
import { padAccountKey20 } from '../codec.js'
import { Balance, BalanceUpdateItem, CustomDiscoveryFetcher, RuntimeQueueData } from '../types.js'
import { calculateFreeBalance } from '../util.js'
import { decodeLog } from './evm.js'

const RUNTIME_API = 'CurrenciesApi'
const RUNTIME_API_METHOD = 'account'

const contractToAssetIdMap: Record<string, number> = {
  '0x02639ec01313c8775fae74f2dad1118c8a8a86da': 1001,
  '0xc64980e4eaf9a1151bd21712b9946b81e41e2b92': 1002,
  '0x2ec4884088d84e5c2970a034732e5209b0acfa93': 1003,
  '0x02759d14d0d4f452b9c76f5a230750e8857d36f2': 1004,
  '0x0e13b904f4168f93814216b6874ca8349457f263': 1005,
  '0x69003a65189f6ed993d3bd3e2b74f1db39f405ce': 1006,
  '0x11a8f7ffbb7e0fbed88bc20179dd45b4bd6874ff': 1007,
  '0xc09cf2f85367f3c2ab66e094283de3a499cb9108': 1008,
  '0x35774c305aaf441a102d47988d35f0f5428471b3': 1110,
  '0x1806860d27ee903c1ec7586d4f7d598d7591f124': 1111,
  '0x7e3ce0257506c3e1f96a2a9b25a9440959b0d453': 1112,
  '0x52e1311e26610e6662a1e5b5bd113130b6815213': 1113,
  '0x531a654d1696ed52e7275a8cede955e82620f99a': 222,
  '0x8a598fe3e3a471ce865332e330d303502a0e2f52': 420,
  '0x34d5ffb83d14d82f87aaf2f13be895a3c814c2ad': 69,
}

async function evmToSubstrateAddress({
  evmAddress,
  chainId,
  ingress,
  apiCtx,
}: {
  evmAddress: HexString
  chainId: NetworkURN
  ingress: SubstrateIngressConsumer
  apiCtx: SubstrateApiContext
}) {
  const codec = apiCtx.storageCodec('EVMAccounts', 'AccountExtension')

  const data = await firstValueFrom(
    ingress.getStorage(chainId, codec.keys.enc(new Binary(fromHex(evmAddress))) as HexString),
  )
  const mapping = data ? codec.value.dec(data) : null

  let buf: Buffer
  if (mapping) {
    buf = Buffer.concat([fromHex(evmAddress), mapping.asBytes()])
  } else {
    buf = padAccountKey20(evmAddress)
  }
  return fromBufferToBase58(0)(new Uint8Array(buf))
}

export function hydrationEVM$(
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
): Observable<BalanceUpdateItem> {
  const streams = SubstrateSharedStreams.instance(ingress)

  return ingress.getContext(chainId).pipe(
    switchMap((apiCtx) =>
      streams.blockEvents(chainId).pipe(
        filter((ev) => isEVMLog(ev)),
        map(decodeLog),
        filter(Boolean),
        mergeMap(({ address, decoded }) => {
          const accounts: { account: HexString; assetId: number }[] = []
          const assetId = contractToAssetIdMap[address]
          if (!assetId) {
            return EMPTY
          }

          if (decoded) {
            const { from, to } = decoded.args

            accounts.push({ account: from, assetId }, { account: to, assetId })
          }
          return accounts
        }),
        mergeMap(({ account, assetId }) =>
          from(evmToSubstrateAddress({ evmAddress: account, chainId, ingress, apiCtx })).pipe(
            map((ss58) => {
              const runtimeApiCodec = apiCtx.runtimeCallCodec(RUNTIME_API, RUNTIME_API_METHOD)
              const assetKeyHash = toHex(
                assetMetadataKeyHash(assetMetadataKey(chainId, assetId)),
              ) as HexString
              const args = [assetId, ss58]
              const data: RuntimeQueueData = {
                api: RUNTIME_API,
                method: RUNTIME_API_METHOD,
                assetKeyHash,
                type: 'runtime',
                args,
                account,
                publicKey: asPublicKey(account),
              }
              return {
                storageKey: toHex(runtimeApiCodec.args.enc(args)) as HexString,
                data,
              }
            }),
          ),
        ),
      ),
    ),
  )
}

export const hydrationBalancesFetcher: CustomDiscoveryFetcher = async ({
  chainId,
  account,
  ingress,
  apiCtx,
}) => {
  const accountId32 = isEVMAddress(account)
    ? await evmToSubstrateAddress({
        evmAddress: account as HexString,
        chainId,
        ingress,
        apiCtx,
      })
    : fromBufferToBase58(0)(fromHex(account))
  const results = await ingress.runtimeCall<[number, Balance][]>(
    chainId,
    {
      api: 'CurrenciesApi',
      method: 'accounts',
    },
    [accountId32],
  )
  if (!results) {
    return []
  }
  return results.map(([assetId, balance]) => ({
    assetId,
    balance: calculateFreeBalance(balance),
  }))
}
