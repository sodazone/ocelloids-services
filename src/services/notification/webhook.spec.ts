import { jest } from '@jest/globals';

import nock from 'nock';
import { MemoryLevel } from 'memory-level';

import { _log, _services } from '../../testing/services.js';

import { QuerySubscription, XcmMatched } from '../monitoring/types.js';
import { Delivered, WebhookNotifier } from './webhook.js';
import { Scheduler } from '../persistence/scheduler.js';

const notification : XcmMatched = {
  subscriptionId: 'ok',
  messageHash: '0xCAFE',
  destination: {
    blockHash: '0xBEEF',
    blockNumber: '2',
    chainId: '0',
    event: {}
  },
  origin: {
    blockHash: '0xBEEF',
    blockNumber: '2',
    chainId: '0',
    event: {}
  },
  outcome: 'Success',
  instructions: '0x',
  messageData: '0x',
  sender: {},
  error: undefined
};

const subOk = {
  destinations: ['1000'],
  id: 'ok',
  notify: {
    type: 'webhook',
    url: 'http://localhost/ok'
  },
  origin: '0',
  senders: '*'
} as QuerySubscription;

const subFail = {
  destinations: ['2000'],
  id: 'fail',
  notify: {
    type: 'webhook',
    url: 'http://localhost/not-found'
  },
  origin: '0',
  senders: '*'
} as QuerySubscription;

const authToken = 'secret';

const subOkAuth = {
  destinations: ['3000'],
  id: 'ok:auth',
  notify: {
    type: 'webhook',
    url: 'http://localhost/ok',
    bearer: authToken
  },
  origin: '0',
  senders: '*'
} as QuerySubscription;

describe('webhook notifier', () => {
  const subs = _services.storage.subs;

  let scheduler : Scheduler;
  let notifier : WebhookNotifier;

  beforeAll(async () => {
    await subs.insert(subOk);
    await subs.insert(subFail);
    await subs.insert(subOkAuth);
  });

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

    await notifier.notify(subOk, notification);

    expect(ok).toHaveBeenCalled();
    scope.done();
  });

  it('should post a notification with bearer auth', async () => {
    const scope = nock('http://localhost', {
      reqheaders: { 'Authorization': 'Bearer ' + authToken }
    })
      .post(/ok\/.+/)
      .reply(200);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify(subOkAuth, notification);

    expect(ok).toHaveBeenCalled();
    scope.done();
  });

  it('should fail posting to the wrong path', async () => {
    const scope = nock('http://localhost')
      .post(/.+/)
      .reply(404);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify(subFail, notification);

    expect(ok).not.toHaveBeenCalled();
    scope.done();
  });

  it('should re-schedule after exhausting retries', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .times(2)
      .reply(500);

    const ok = jest.fn();
    notifier.on(Delivered, ok);

    await notifier.notify(subOk, notification);

    expect(ok).not.toHaveBeenCalled();
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

    await notifier.notify(subOk, notification);

    expect(ok).toHaveBeenCalled();

    scope.done();
  });
});
