import { jest } from '@jest/globals';

import { FastifyInstance } from 'fastify';

import { buildMockServer } from '../../../_mocks/webhook.js';
import { _log, _services } from '../../../_mocks/services.js';

import { XcmMessageNotify } from '../types.js';

import { Delivered, WebhookNotifier } from './webhook.js';

const notification : XcmMessageNotify = {
  subscriptionId: '1',
  messageHash: '0xCAFE',
  destination: {
    blockHash: '0xBEEF',
    blockNumber: '2',
    chainId: 0,
    event: {}
  },
  origin: {
    blockHash: '0xBEEF',
    blockNumber: '2',
    chainId: 0,
    event: {}
  },
  outcome: 'Success',
  instructions: '0x',
  messageData: '0x',
  error: undefined
};

describe('webhook notifier', () => {
  let webhookUrl : string;
  let fastify : FastifyInstance;

  beforeAll(async () => {
    fastify = buildMockServer({
      ok: request => {
        expect(request.body).toEqual(notification);
      }
    });
    await fastify.listen({
      port: 0
    });
    const { port } = fastify.server.address() as {
      port: number
    };

    webhookUrl = `http://localhost:${port}/`;
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should post a notification', async () => {
    const notifier = new WebhookNotifier(_services);
    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: webhookUrl + 'ok'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).toBeCalled();
  });

  it('should fail posting to the wrong path', async () => {
    const notifier = new WebhookNotifier(_services);
    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: webhookUrl + 'not-found'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).not.toBeCalled();
  });
});
