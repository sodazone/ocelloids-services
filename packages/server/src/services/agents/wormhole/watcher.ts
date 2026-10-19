import { Observable } from 'rxjs'
import { getConsensus } from '@/services/config.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { extractTransactions } from '@/services/networking/near/extract.js'
import { Logger, NetworkURN } from '@/services/types.js'
import {
  extractNearNttTransferRedeemed,
  extractNttTransferRedeemed,
  TransferRedeemedPayload,
} from './ntt/ops.js'

export type NttWatcher = {
  getStream: (networkId: NetworkURN) => Observable<TransferRedeemedPayload> | null
}

export function toNttWatcher(log: Logger, ingress: IngressConsumers): NttWatcher {
  const id = 'wormhole:watcher'

  function getEvmStream(networkId: NetworkURN): Observable<TransferRedeemedPayload> | null {
    if (!ingress.evm.isNetworkDefined(networkId)) {
      log.warn('[%s] %s not configured, skipping subscription to NTT redeem events.', id, networkId)
      return null
    }

    return ingress.evm
      .streamLogs(networkId)
      .pipe(
        extractNttTransferRedeemed(networkId, (blockNumber: bigint | string) =>
          ingress.evm.getBlockTimestampMs(networkId, blockNumber),
        ),
      )
  }

  function getNearStream(networkId: NetworkURN) {
    if (!ingress.near.isNetworkDefined(networkId)) {
      log.warn('[%s] %s not configured, skipping subscription to NTT redeem events.', id, networkId)
      return null
    }

    return ingress.near.finalizedBlocks(networkId).pipe(
      extractTransactions(),
      extractNearNttTransferRedeemed(networkId, (txHash: string, senderAccountId: string) =>
        ingress.near.getTransactionStatus(networkId, txHash, senderAccountId),
      ),
    )
  }

  function getStream(networkId: NetworkURN): Observable<TransferRedeemedPayload> | null {
    const consensus = getConsensus(networkId)
    if (consensus === 'ethereum') {
      return getEvmStream(networkId)
    }
    if (consensus === 'near') {
      return getNearStream(networkId)
    }

    return null
  }

  return {
    getStream,
  }
}
