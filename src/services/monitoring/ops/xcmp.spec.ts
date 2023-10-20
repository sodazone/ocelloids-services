import { xcmpSend, xcmpReceive } from '../../../_mocks/xcm.js';
import { extractXcmpReceive, extractXcmpSend } from './xcmp.js';

describe('xcmp operator', () => {
  describe('extractXcmpSend', () => {
    it('should extract xcmp sent message', done => {
      const {
        blocks,
        apiPromise,
        sendersControl,
        messageControl,
        getHrmp
      } = xcmpSend;

      const calls = jest.fn();

      const testPipe = extractXcmpSend(
        apiPromise,
        {
          sendersControl,
          messageControl
        },
        getHrmp
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

  describe('extractXcmpReceive', () => {
    it('should extract xcmp receive with outcome success', done => {
      const { successBlocks } = xcmpReceive;

      const calls = jest.fn();

      const testPipe = extractXcmpReceive()(successBlocks);

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

    it('should extract xcmp receive with outcome fail', done => {
      const { failBlocks } = xcmpReceive;

      const calls = jest.fn();

      const testPipe = extractXcmpReceive()(failBlocks);

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
        },
        complete: () => {
          expect(calls).toBeCalledTimes(1);
          done();
        }
      });
    });
  });
});