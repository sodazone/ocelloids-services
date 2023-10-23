import { FastifyInstance } from 'fastify';

import { buildMockServer } from '../../../_mocks/webhook.js';
import { _log, _services } from '../../../_mocks/services.js';

import { XcmMessageNotify } from '../types.js';
import { WebhookNotifier } from './webhook.js';

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
    fastify = buildMockServer(request => {
      expect(request.body).toEqual(notification);
    });
    await fastify.listen({
      port: 0
    });
    const { address, port } = fastify.server.address() as {
      address: string,
      port: number
    };
    webhookUrl = `http://${address}:${port}/xcm-notifications`;
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should post a notification', async () => {
    const notifier = new WebhookNotifier(_services);
    const delivered = await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: webhookUrl
      },
      origin: 0,
      senders: []
    }, notification);

    expect(delivered).toBe(true);
  });

  it('should fail posting to the wrong path', async () => {
    const notifier = new WebhookNotifier(_services);
    const delivered = await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: webhookUrl + '/nowhere'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(delivered).toBe(false);
  });
});
