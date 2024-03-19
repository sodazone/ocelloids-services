import { jest } from '@jest/globals';

import { of } from 'rxjs';

import {
  dmpReceive,
  dmpSendMultipleMessagesInQueue,
  dmpSendSingleMessageInQueue,
  dmpXcmPalletSentEvent,
  registry,
  xcmHop,
  xcmHopOrigin,
} from '../../../testing/xcm.js';
import { extractDmpReceive, extractDmpSend, extractDmpSendByEvent } from './dmp.js';
import { extractEvents, extractTxWithEvents } from '@sodazone/ocelloids-sdk';

const getDmp = () =>
  of([
    {
      msg: new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
      toU8a: () => new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
    },
  ] as unknown as any);

describe('dmp operator', () => {
  describe('extractDmpSend', () => {
    it('should extract DMP sent message', (done) => {
      const { origin, blocks, sendersControl, messageControl } = dmpSendSingleMessageInQueue;

      const calls = jest.fn();

      const test$ = extractDmpSend(
        origin,
        {
          sendersControl,
          messageControl,
        },
        getDmp,
        registry
      )(blocks.pipe(extractTxWithEvents()));

      test$.subscribe({
        next: (msg) => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.instructions).toBeDefined();
          expect(msg.messageData).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.recipient).toBeDefined();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('should extract DMP sent for multi-leg messages', (done) => {
      const { origin, blocks, sendersControl, messageControl } = xcmHopOrigin;

      const calls = jest.fn();

      const test$ = extractDmpSendByEvent(
        origin,
        {
          sendersControl,
          messageControl,
        },
        getDmp,
        registry
      )(blocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.instructions).toBeDefined();
          expect(msg.messageData).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.recipient).toBeDefined();
          calls();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('should extract DMP sent message with multiple messages in the queue', (done) => {
      const { origin, blocks, sendersControl, messageControl } = dmpSendMultipleMessagesInQueue;

      const calls = jest.fn();

      const test$ = extractDmpSend(
        origin,
        {
          sendersControl,
          messageControl,
        },
        getDmp,
        registry
      )(blocks.pipe(extractTxWithEvents()));

      test$.subscribe({
        next: (msg) => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.instructions).toBeDefined();
          expect(msg.messageData).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.recipient).toBeDefined();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });

  describe('extractDmpSendByEvent', () => {
    it('should extract DMP sent message filtered by event', (done) => {
      const { origin, blocks, sendersControl, messageControl } = dmpXcmPalletSentEvent;

      const calls = jest.fn();

      const test$ = extractDmpSendByEvent(
        origin,
        {
          sendersControl,
          messageControl,
        },
        getDmp,
        registry
      )(blocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.instructions).toBeDefined();
          expect(msg.messageData).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.recipient).toBeDefined();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });

  describe('extractDmpReceive', () => {
    it('should extract DMP received message with outcome success', (done) => {
      const { successBlocks } = dmpReceive;

      const calls = jest.fn();

      const test$ = extractDmpReceive()(successBlocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.event).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.outcome).toBeDefined();
          expect(msg.outcome).toBe('Success');
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('should extract failed DMP received message with error', (done) => {
      const { failBlocks } = dmpReceive;

      const calls = jest.fn();

      const test$ = extractDmpReceive()(failBlocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.event).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.outcome).toBeDefined();
          expect(msg.outcome).toBe('Fail');
          expect(msg.error).toBeDefined();
          expect(msg.error).toBe('UntrustedReserveLocation');
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('should extract dmp receive with asset trap', (done) => {
      const { trappedBlocks } = dmpReceive;

      const calls = jest.fn();

      const test$ = extractDmpReceive()(trappedBlocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.event).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.outcome).toBeDefined();
          expect(msg.outcome).toBe('Fail');
          expect(msg.error).toBeDefined();
          expect(msg.error).toBe('FailedToTransactAsset');
          expect(msg.assetsTrapped).toBeDefined();
          calls();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('should extract DMP received for hop message', (done) => {
      const { blocks } = xcmHop;

      const calls = jest.fn();

      const test$ = extractDmpReceive()(blocks.pipe(extractEvents()));

      test$.subscribe({
        next: (msg) => {
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.event).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.outcome).toBeDefined();
          expect(msg.outcome).toBe('Success');
          calls();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });
});
