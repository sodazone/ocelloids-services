import { ControlQuery, Criteria } from '@/common/index.js'

import { SignerData } from '../../../subscriptions/types.js'
import { NetworkURN } from '../../../types.js'
import { XcmTerminus } from '../types.js'

export function sendersCriteria(senders?: string[] | '*'): Criteria {
  if (senders === undefined || senders === '*') {
    // match any
    return {}
  } else {
    return {
      $or: [
        { 'sender.signer.id': { $in: senders } },
        { 'sender.signer.publicKey': { $in: senders } },
        { 'sender.extraSigners.id': { $in: senders } },
        { 'sender.extraSigners.publicKey': { $in: senders } },
      ],
    }
  }
}

// Assuming we are in the same consensus
export function messageCriteria(chainIds: NetworkURN[]): Criteria {
  return {
    chainId: { $in: chainIds },
  }
}

/**
 * Matches sender account address and public keys, including extra senders.
 */
export function matchSenders(query: ControlQuery, sender?: SignerData): boolean {
  if (sender === undefined) {
    return query.value.test({
      sender: undefined,
    })
  }

  return query.value.test({
    sender,
  })
}

/**
 * Matches XCM terminus.
 */
export function matchMessage(query: ControlQuery, xcm: XcmTerminus): boolean {
  return query.value.test({ chainId: xcm.chainId })
}
