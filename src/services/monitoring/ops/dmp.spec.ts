import { jest } from '@jest/globals';

import { dmpReceive, dmpSendMultipleMessagesInQueue, dmpSendSingleMessageInQueue } from '../../../test/xcm.js';
import { extractDmpReceive, extractDmpSend } from './dmp.js';

describe('dmp operator', () => {
  describe('extractDmpSend', () => {
    it('should extract DMP sent message', done => {
      const {
        blocks,
        apiPromise,
        sendersControl,
        messageControl
      } = dmpSendSingleMessageInQueue;

      const calls = jest.fn();

      const testPipe = extractDmpSend(
        apiPromise,
        {
          sendersControl,
          messageControl
        }
      )(blocks);

      testPipe.subscribe({
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
          expect(calls).toBeCalledTimes(1);
          done();
        }
      });
    });

    it('should extract DMP sent message with multiple messages in the queue', done => {
      const {
        blocks,
        apiPromise,
        sendersControl,
        messageControl
      } = dmpSendMultipleMessagesInQueue;

      const calls = jest.fn();

      const testPipe = extractDmpSend(
        apiPromise,
        {
          sendersControl,
          messageControl
        }
      )(blocks);

      testPipe.subscribe({
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
          expect(calls).toBeCalledTimes(1);
          done();
        }
      });
    });
  });

  describe('extractDmpReceive', () => {
    it('should extract DMP received message with outcome success', done => {
      const { successBlocks } = dmpReceive;

      const calls = jest.fn();

      const testPipe = extractDmpReceive()(successBlocks);

      testPipe.subscribe({
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
          expect(calls).toBeCalledTimes(1);
          done();
        }
      });
    });

    it('should extract failed DMP received message with error', done => {
      const { failBlocks } = dmpReceive;

      const calls = jest.fn();

      const testPipe = extractDmpReceive()(failBlocks);

      testPipe.subscribe({
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
          expect(msg.error).toBe('UntrustedReserveLocation');
        },
        complete: () => {
          expect(calls).toBeCalledTimes(1);
          done();
        }
      });
    });
  });
});