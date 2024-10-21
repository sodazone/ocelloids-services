import { ControlQuery, Criteria } from '@/sdk/index.js'

import { SignerData } from '../../../subscriptions/types.js'
import { NetworkURN } from '../../../types.js'
import { XcmSent } from '../types.js'

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
export function messageCriteria(recipients: NetworkURN[]): Criteria {
  return {
    recipient: { $in: recipients },
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
 * Matches outbound XCM recipients.
 */
export function matchMessage(query: ControlQuery, xcm: XcmSent): boolean {
  return query.value.test({ recipient: xcm.destination.chainId })
}
