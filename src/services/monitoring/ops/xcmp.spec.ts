import { jest } from '@jest/globals';

import { xcmpSend, xcmpReceive } from '../../../testing/xcm.js';

import { extractXcmpReceive, extractXcmpSend } from './xcmp.js';

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract XCMP sent message', done => {
      const {
        blocks,
        sendersControl,
        messageControl,
        getHrmp
      } = xcmpSend;

      const calls = jest.fn();

      const test$ = extractXcmpSend(
        {
          sendersControl,
          messageControl
        },
        getHrmp
      )(blocks);

      test$.subscribe({
        next: msg => {
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
        }
      });
    });
  });

  describe('extractXcmpReceive', () => {
    it('should extract XCMP receive with outcome success', done => {
      const { successBlocks } = xcmpReceive;

      const calls = jest.fn();

      const test$ = extractXcmpReceive()(successBlocks);

      test$.subscribe({
        next: msg => {
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
        }
      });
    });

    it('should extract failed XCMP received message with error', done => {
      const { failBlocks } = xcmpReceive;

      const calls = jest.fn();

      const test$ = extractXcmpReceive()(failBlocks);

      test$.subscribe({
        next: msg => {
          calls();
          expect(msg).toBeDefined();
          expect(msg.blockNumber).toBeDefined();
          expect(msg.blockHash).toBeDefined();
          expect(msg.event).toBeDefined();
          expect(msg.messageHash).toBeDefined();
          expect(msg.outcome).toBeDefined();
          expect(msg.outcome).toBe('Fail');
          expect(msg.error).toBeDefined();
        },
        complete: () => {
          expect(calls).toHaveBeenCalledTimes(1);
          done();
        }
      });
    });
  });
});