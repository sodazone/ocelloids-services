import { ControlQuery, Criteria, types } from '@sodazone/ocelloids-sdk';
import { XcmSentWithContext } from '../types.js';

export function sendersCriteria(senders?: string[] | '*'): Criteria {
  if (senders === undefined || senders === '*') {
    // match any
    return {};
  } else {
    return {
      $or: [
        { 'extrinsic.signer.id': { $in: senders } },
        { 'extrinsic.signer.publicKey': { $in: senders } },
        { 'extrinsic.extraSigners.id': { $in: senders } },
        { 'extrinsic.extraSigners.publicKey': { $in: senders } },
      ],
    };
  }
}

export function messageCriteria(recipients: string[]): Criteria {
  return {
    recipient: { $in: recipients },
  };
}

function createSignersData(xt: types.ExtrinsicWithId) {
  try {
    if (xt.isSigned) {
      // Signer could be Address or AccountId
      const accountId = xt.signer.value ?? xt.signer;
      return {
        signer: {
          id: accountId.toPrimitive(),
          publicKey: accountId.toHex(),
        },
        extraSigners: xt.extraSigners.map((signer) => ({
          type: signer.type,
          id: signer.address.value.toPrimitive(),
          publicKey: signer.address.value.toHex(),
        })),
      };
    }
  } catch (error) {
    throw new Error(`creating signers data at ${xt.extrinsicId} ${xt.signer.toRawType()}`, { cause: error });
  }

  return {};
}

/**
 * Matches sender account address and public keys, including extra senders.
 */
export function matchSenders(query: ControlQuery, xt?: types.ExtrinsicWithId): boolean {
  if (xt === undefined) {
    return query.value.test({
      extrinsic: undefined,
    });
  }

  // TODO: this is not needed if the query is '*'
  // but no easy way to know it.
  const signersData = createSignersData(xt);

  return query.value.test({
    extrinsic: signersData,
  });
}

/**
 * Matches outbound XCM recipients.
 */
export function matchMessage(query: ControlQuery, xcm: XcmSentWithContext): boolean {
  return query.value.test({ recipient: xcm.recipient });
}
