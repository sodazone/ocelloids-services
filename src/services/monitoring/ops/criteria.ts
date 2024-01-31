import { Criteria } from '@sodazone/ocelloids';

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