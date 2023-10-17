import { Criteria } from '@sodazone/ocelloids';

export function sendersCriteria(senders: string[]) : Criteria {
  return {
    'extrinsic.signer.id': { $in: senders }
  };
}

export function messageCriteria(recipients: number[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}