import { ControlQuery, Criteria } from '@/common/index.js'

import { SignerData } from '../../../subscriptions/types.js'
import { XcmNotificationType, XcmTerminus } from '../types.js'

const MATCH_ANY = {}

export function sendersCriteria(senders?: string[] | '*'): Criteria {
  if (senders === undefined || senders === '*') {
    return MATCH_ANY
  }

  return {
    $or: [
      { 'sender.signer.id': { $in: senders } },
      { 'sender.signer.publicKey': { $in: senders } },
      { 'sender.extraSigners.id': { $in: senders } },
      { 'sender.extraSigners.publicKey': { $in: senders } },
    ],
  }
}

export function messageCriteria(chainIds: string[] | '*'): Criteria {
  if (chainIds === '*') {
    return MATCH_ANY
  }

  return {
    chainId: { $in: chainIds },
  }
}

export function notificationTypeCriteria(types?: string[] | '*'): Criteria {
  if (types === undefined || types === '*') {
    return MATCH_ANY
  }

  return {
    notificationType: { $in: types },
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

/**
 * Matches XCM notification types
 */
export function matchNotificationType(query: ControlQuery, notificationType: XcmNotificationType) {
  return query.value.test({ notificationType })
}
