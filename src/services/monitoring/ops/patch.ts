import { map, Observable } from 'rxjs';

import {
  HexString,
  XcmMessageSentWithContext
} from '../types.js';

/**
 * Temporary patch.
 * To keep consistency until message ids using topic instructions are
 * standarised, we just override the message hash, as a workaround when
 * the SetTopic instruction is present.
 */
export function messageIdOrHashPatch() {
  return (source: Observable<XcmMessageSentWithContext>)
  : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      map(p => {
        const instructions : any = p.instructions;
        const setTopic = (instructions['V3'] as any[]).find((i: any) => i['SetTopic'] !== undefined);
        console.log('APPYLING PATCH', p.blockNumber, p.messageHash, setTopic);
        const hashPatch =  setTopic ? setTopic['SetTopic'] as HexString : p.messageHash;
        return {
          ...p,
          messageHash: hashPatch
        } as XcmMessageSentWithContext;
      })
    );
  };
}