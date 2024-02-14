import { jest } from '@jest/globals';
import { ControlQuery, extractEvents } from '@sodazone/ocelloids';

import { xcmpSend, xcmpReceive } from '../../../testing/xcm.js';

import { extractXcmpReceive, extractXcmpSend } from './xcmp.js';
import { sendersCriteria } from './criteria.js';

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
      )(blocks.pipe(extractEvents()));

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

  it('should extract XCMP sent message matching by public key', done => {
    const {
      blocks,
      messageControl,
      getHrmp
    } = xcmpSend;

    const calls = jest.fn();

    const test$ = extractXcmpSend(
      {
        sendersControl: new ControlQuery(
          sendersCriteria(['0x8e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368'])
        ),
        messageControl
      },
      getHrmp
    )(blocks.pipe(extractEvents()));

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

  describe('extractXcmpReceive', () => {
    it('should extract XCMP receive with outcome success', done => {
      const { successBlocks } = xcmpReceive;

      const calls = jest.fn();

      const test$ = extractXcmpReceive()(successBlocks.pipe(extractEvents()));

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

      const test$ = extractXcmpReceive()(failBlocks.pipe(extractEvents()));

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