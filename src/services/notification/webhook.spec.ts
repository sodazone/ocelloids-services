import { jest } from '@jest/globals';

import { FastifyInstance } from 'fastify';

import { buildMockServer } from '../../test/webhook.js';
import { _log, _services } from '../../test/services.js';

import { XcmMessageNotify } from '../monitoring/types.js';

import { Delivered, WebhookNotifier } from './webhook.js';
import { Scheduler } from '../persistence/scheduler.js';

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

  let scheduler : Scheduler;
  let notifier : WebhookNotifier;

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

  beforeEach(() => {
    scheduler = new Scheduler(
      _services.log,
      _services.storage.root,
      {
        scheduler: true,
        schedFrequency: 500
      });
    notifier = new WebhookNotifier({
      ..._services,
      scheduler
    });
  });

  it('should post a notification', async () => {
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
