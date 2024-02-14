import { jest } from '@jest/globals';

import nock from 'nock';
import { MemoryLevel } from 'memory-level';

import { _log, _services } from '../../testing/services.js';

import { QuerySubscription, XcmNotificationType, XcmNotifyMessage, XcmTerminiContext } from '../monitoring/types.js';
import { WebhookNotifier } from './webhook.js';
import { Scheduler } from '../persistence/scheduler.js';
import { NotifierHub } from './hub.js';

const destinationContext: XcmTerminiContext = {
  blockHash: '0xBEEF',
  blockNumber: '2',
  chainId: '1',
  event: {},
  outcome: 'Success',
  error: null
};
const notification : XcmNotifyMessage = {
  type: XcmNotificationType.Received,
  subscriptionId: 'ok',
  messageHash: '0xCAFE',
  legs: [{ from: '0', to: '1' }],
  waypoint: {
    ...destinationContext,
    legIndex: 0
  },
  destination: destinationContext,
  origin: {
    blockHash: '0xBEEF',
    blockNumber: '2',
    chainId: '0',
    event: {},
    outcome: 'Success',
    error: null
  },
  instructions: '0x',
  messageData: '0x',
  sender: { id: 'w123' },
};

const subOk = {
  destinations: ['1000'],
  id: 'ok',
  channels: [{
    type: 'webhook',
    url: 'http://localhost/ok'
  }],
  origin: '0',
  senders: '*',
  events: '*'
} as QuerySubscription;

const xmlTemplate = `
<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN"
        "http://dtd.worldpay.com/paymentService_v1.dtd">
<paymentService version="1.4" merchantCode="MERCHANTCODE">
    <notify>
      <xcmStatusEvent subscriptionId="{{subscriptionId}}" outcome="{{waypoint.outcome}}">
        <sender>{{sender.id}}</sender>
        {{#if waypoint.error}}
        <error>{{waypoint.error}}</error>
        {{/if}}
      </xcmStatusEvent>
    </notify>
</paymentService>
`;
const subOkXml = {
  destinations: ['0'],
  id: 'ok:xml',
  channels: [{
    type: 'webhook',
    url: 'http://localhost/ok',
    contentType: 'application/xml',
    template: xmlTemplate
  }],
  origin: '1000',
  senders: '*',
  events: '*'
} as QuerySubscription;

const subFail = {
  destinations: ['2000'],
  id: 'fail',
  channels: [{
    type: 'webhook',
    url: 'http://localhost/not-found'
  }],
  origin: '0',
  senders: '*',
  events: '*'
} as QuerySubscription;

const authToken = 'secret';

const subOkAuth = {
  destinations: ['3000'],
  id: 'ok:auth',
  channels: [{
    type: 'webhook',
    url: 'http://localhost/ok',
    bearer: authToken
  }],
  origin: '0',
  senders: '*',
  events: '*'
} as QuerySubscription;

describe('webhook notifier', () => {
  const subs = _services.storage.subs;

  let scheduler : Scheduler;
  let notifier : WebhookNotifier;
  let hub: NotifierHub;

  beforeAll(async () => {
    await subs.insert(subOk);
    await subs.insert(subOkXml);
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
    hub = new NotifierHub(
      _services
    );
    notifier = new WebhookNotifier(
      hub,
      {
        ..._services,
        scheduler
      });
  });

  it('should post a notification', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/json')
      .post(/ok\/.+/)
      .reply(200);

    const ok = jest.fn();
    notifier.on('telemetryNotify', ok);

    await notifier.notify(subOk, notification);

    expect(ok).toHaveBeenCalled();
    scope.done();
  });

  it('should post an XML notification', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/xml')
      .post(/ok\/.+/, /<sender>w123<\/sender>/gi)
      .reply(200);

    const ok = jest.fn();
    notifier.on('telemetryNotify', ok);

    await notifier.notify(subOkXml, {
      ...notification, subscriptionId: 'ok:xml'
    });

    expect(ok).toHaveBeenCalled();
    scope.done();
  });

  it('should post a notification with bearer auth', async () => {
    const scope = nock('http://localhost', {
      reqheaders: { 'Authorization': 'Bearer ' + authToken }
    }).post(/ok\/.+/).reply(200);

    const ok = jest.fn();
    notifier.on('telemetryNotify', ok);

    await notifier.notify(subOkAuth, notification);

    expect(ok).toHaveBeenCalled();
    scope.done();
  });

  it('should fail posting to the wrong path', async () => {
    const scope = nock('http://localhost')
      .post(/.+/)
      .reply(404);

    const ok = jest.fn();
    notifier.on('telemetryNotify', ok);

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
    notifier.on('telemetryNotify', ok);

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
    notifier.on('telemetryNotify', ok);

    await notifier.notify(subOk, notification);

    expect(ok).toHaveBeenCalled();

    scope.done();
  });
});
