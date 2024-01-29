import { Criteria } from '@sodazone/ocelloids';

export function sendersCriteria(senders: string[] | '*') : Criteria {
  if (Array.isArray(senders)) {
    return {
      'extrinsic.signer.id': { $in: senders }
    };
  } else {
    return {
      'extrinsic.signer': { $exists: true }
    };
  }
}

export function messageCriteria(recipients: string[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}