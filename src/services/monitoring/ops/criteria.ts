import { ControlQuery, Criteria, types } from '@sodazone/ocelloids';
import { XcmSentWithContext } from '../types.js';

export function sendersCriteria(senders: string[] | '*') : Criteria {
  if (Array.isArray(senders)) {
    return {
      $or: [
        { 'extrinsic.signer.id': { $in: senders } },
        { 'extrinsic.signer.publicKey': { $in: senders } },
        { 'extrinsic.extraSigners.id': { $in: senders } },
        { 'extrinsic.extraSigners.publicKey': { $in: senders } }
      ]
    };
  } else {
    // match any
    return {};
  }
}

export function messageCriteria(recipients: string[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}

/**
 * Matches sender account address and public keys, including extra senders.
 */
export function matchSenders(
  query: ControlQuery, xt?: types.ExtrinsicWithId
): boolean {
  if (xt === undefined) {
    return false;
  }

  // TODO: this is not needed if the query is '*'
  // but no easy way to know it.
  const signersData = xt.isSigned
    ? {
      signer: Object.assign({},
        xt.signer.toPrimitive(),
        { publicKey: xt.signer.value.toHex() }
      ),
      extraSigners: xt.extraSigners.map(
        signer => Object.assign(
          {},
          signer.address.toPrimitive(),
          {
            type: signer.type,
            publicKey: signer.address.value.toHex()
          }
        )
      )
    }
    : {};

  return query.value.test({
    extrinsic: signersData
  });
}

/**
 * Matches outbound XCM recipients.
 */
export function matchMessage(
  query: ControlQuery, xcm: XcmSentWithContext
): boolean {
  return query.value.test({ recipient: xcm.recipient });
}