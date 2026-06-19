import { deserialize } from '@wormhole-foundation/sdk-definitions'
import { toHex } from 'polkadot-api/utils'
import { filter, map, Observable } from 'rxjs'
import { Abi, decodeAbiParameters, padHex } from 'viem'
import { normalizePublicKey } from '@/common/index.js'
import { extractEvmTransactions } from '@/services/networking/substrate/index.js'
import { BlockExtrinsicWithEvents } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../../common/networks.js'
import basejumpProxyAbi from '../abis/basejump-proxy.json' with { type: 'json' }
import { BasejumpRelayedWithContext, MessageOutcome } from '../types.js'

const CHAIN_URN = networks.moonbeam

const WormholeChainNameToIdMap: Record<string, number> = {
  base: 30,
}

function decodeFastTrackPayload(payload: HexString) {
  const [sourceAsset, amount, recipient, transferSequence] = decodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint64' }],
    payload,
  )

  return {
    sourceAsset,
    amount,
    recipient,
    transferSequence,
  }
}

export function extractBasejumpProxy(chainId: NetworkURN, contractAddress: HexString) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<BasejumpRelayedWithContext> => {
    return source.pipe(
      extractEvmTransactions([{ abi: basejumpProxyAbi as Abi, addresses: [contractAddress] }]),
      map((evmTx) => {
        try {
          const { blockHash, blockNumber, timestamp, hash, executed, decoded } = evmTx
          if (
            !decoded ||
            !['completeTransfer', 'receiveMessage'].includes(decoded.functionName) ||
            !executed
          ) {
            return null
          }
          const [vaaHex] = decoded.args as [HexString]
          const vaaBytes = new Uint8Array(Buffer.from(vaaHex.slice(2), 'hex'))
          const { payload, emitterChain, emitterAddress, sequence, guardianSet } = deserialize(
            'Uint8Array',
            vaaBytes,
          )

          const emitterChainId = WormholeChainNameToIdMap[emitterChain.toLowerCase()]
          if (!emitterChainId) {
            return null
          }
          const vaaId = `${emitterChainId}/${padHex(emitterAddress.toString() as HexString).slice(2)}/${sequence}`
          const outcome: MessageOutcome =
            executed.exit_reason.type.toLowerCase() === 'succeed' ? 'Success' : 'Fail'
          const { sourceAsset, amount, recipient } = decodeFastTrackPayload(toHex(payload) as HexString)

          const msg: BasejumpRelayedWithContext = {
            chainId,
            blockNumber: blockNumber.toString(),
            blockHash: blockHash as HexString,
            vaaId,
            payload: Buffer.from(payload).toString('base64'),
            txHash: hash as HexString,
            txHashSecondary: executed.transaction_hash as HexString,
            timestamp,
            relayer: normalizePublicKey(executed.from as HexString),
            outcome,
            guardianSet,
            amount: amount.toString(),
            asset: sourceAsset.toLowerCase() as HexString,
            recipient: normalizePublicKey(recipient),
          }
          return msg
        } catch (e) {
          console.error(
            e,
            `[${CHAIN_URN}] Error processing Basejump transaction at block ${evmTx.blockHash} (#${evmTx.blockNumber})`,
          )
          return null
        }
      }),
      filter((msg) => msg !== null),
    )
  }
}
