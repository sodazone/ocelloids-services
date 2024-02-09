import { ControlQuery, Criteria, types } from '@sodazone/ocelloids';
import { XcmSentWithContext } from '../types.js';

export function sendersCriteria(senders: string[] | '*') : Criteria {
  if (Array.isArray(senders)) {
    return {
      $or: [
        { 'extrinsic.signer.id': { $in: senders } },
        { 'extrinsic.extraSigners.address.id': { $in: senders } }
      ]
    };
  } else {
    return {};
  }
}

export function messageCriteria(recipients: string[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}

export function matchSenders(query: ControlQuery, xt?: types.ExtrinsicWithId) {
  if (xt === undefined) {
    return false;
  }

  return query.value.test({
    extrinsic: {
      signer: xt.signer.toPrimitive(),
      extraSigners: xt.extraSigners
    }
  });
}

export function matchMessage(query: ControlQuery, xcm: XcmSentWithContext) {
  return query.value.test({ recipient: xcm.recipient });
}