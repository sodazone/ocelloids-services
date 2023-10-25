import { jest } from '@jest/globals';

import nock from 'nock';
import { MemoryLevel } from 'memory-level';

import { _log, _services } from '../../testing/services.js';

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
  let scheduler : Scheduler;
  let notifier : WebhookNotifier;

  afterAll(() => {
    nock.restore();
  });

  beforeEach(() => {
    scheduler = new Scheduler(
      _services.log,
      new MemoryLevel(),
      {
        scheduler: true,
        schedulerFrequency: 500
      });
    notifier = new WebhookNotifier({
      ..._services,
      scheduler
    });
  });

  it('should post a notification', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .reply(200);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: 'http://localhost/ok'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).toBeCalled();
    scope.done();
  });

  it('should post a notification with bearer auth', async () => {
    const token = 'secret';
    const scope = nock('http://localhost', {
      reqheaders: { 'Authorization': 'Bearer ' + token }
    })
      .post(/ok\/.+/)
      .reply(200);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: 'http://localhost/ok',
        bearer: token
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).toBeCalled();
    scope.done();
  });

  it('should fail posting to the wrong path', async () => {
    const scope = nock('http://localhost')
      .post(/.+/)
      .reply(404);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: 'http://localhost/not-found'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).not.toBeCalled();
    scope.done();
  });

  it('should re-schedule after exhausting retries', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .times(2)
      .reply(500);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: 'http://localhost/ok',
        limit: 1
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).not.toBeCalled();
    expect((await scheduler.allTaskTimes()).length).toBe(1);

    scope.done();
  });

  it('should retry a notification', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .reply(500)
      .post(/ok\/.+/)
      .reply(200);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify({
      destinations: [],
      id: 'xyz',
      notify: {
        type: 'webhook',
        url: 'http://localhost/ok'
      },
      origin: 0,
      senders: []
    }, notification);

    expect(ok).toBeCalled();

    scope.done();
  });
});
