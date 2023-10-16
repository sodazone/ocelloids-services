import { Criteria } from '@sodazone/ocelloids';

export function sendersCriteria(senders: string[]) : Criteria {
  return {
    'events.event.section': 'xcmpQueue',
    'events.event.method': 'XcmpMessageSent',
    'block.extrinsics.signer.id': { $in: senders }
  };
}

export function messageCriteria(recipients: number[]) : Criteria {
  return {
    'recipient': { $in: recipients }
  };
}