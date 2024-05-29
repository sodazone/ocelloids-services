import { jest } from '@jest/globals'

import { MemoryLevel } from 'memory-level'
import nock from 'nock'

import { _log, _services } from '../../testing/services.js'

import { Scheduler } from '../persistence/scheduler.js'
import { Subscription } from '../subscriptions/types.js'
import { NotifierHub } from './hub.js'
import { NotifyMessage } from './types.js'
import { WebhookNotifier } from './webhook.js'

const notification: NotifyMessage = {
  metadata: {
    type: 'xcm.ok',
    agentId: 'xcm',
    subscriptionId: 'ok',
  },
  payload: {
    foo: 'bar',
  },
}

const subOk = {
  id: 'ok',
  agent: 'xcm',
  args: {
    destinations: ['urn:ocn:local:1000'],
    origin: 'urn:ocn:local:0',
    senders: '*',
    events: '*',
  },
  channels: [
    {
      type: 'webhook',
      url: 'http://localhost/ok',
    },
  ],
} as Subscription

const xmlTemplate = `
<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN"
        "http://dtd.worldpay.com/paymentService_v1.dtd">
<paymentService version="1.4" merchantCode="MERCHANTCODE">
    <notify>
      <xcmStatusEvent type="{{type}}" subscriptionId="{{subscriptionId}}" outcome="{{waypoint.outcome}}">
        <origin block="{{origin.blockHash}}">{{origin.chainId}}</origin>
        <destination>{{destination.chainId}}</destination>
        <sender>{{sender.signer.id}}</sender>
        {{#if waypoint.error}}
        <error>{{waypoint.error}}</error>
        {{/if}}
      </xcmStatusEvent>
    </notify>
</paymentService>
`
const subOkXml = {
  id: 'ok:xml',
  agent: 'xcm',
  channels: [
    {
      type: 'webhook',
      url: 'http://localhost/ok',
      contentType: 'application/xml',
      template: xmlTemplate,
    },
  ],
  args: {
    origin: 'urn:ocn:local:1000',
    destinations: ['urn:ocn:local:0'],
    senders: '*',
    events: '*',
  },
} as Subscription

const subFail = {
  id: 'fail',
  agent: 'xcm',
  channels: [
    {
      type: 'webhook',
      url: 'http://localhost/not-found',
    },
  ],
  args: {
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:2000'],
    senders: '*',
    events: '*',
  },
} as Subscription

const authToken = 'secret'

const subOkAuth = {
  id: 'ok:auth',
  agent: 'xcm',
  channels: [
    {
      type: 'webhook',
      url: 'http://localhost/ok',
      bearer: authToken,
    },
  ],
  args: {
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:3000'],
    senders: '*',
    events: '*',
  },
} as Subscription

describe('webhook notifier', () => {
  const subs = _services.subsStore

  let scheduler: Scheduler
  let notifier: WebhookNotifier
  let hub: NotifierHub

  beforeAll(async () => {
    await subs.insert(subOk)
    await subs.insert(subOkXml)
    await subs.insert(subFail)
    await subs.insert(subOkAuth)
  })

  afterAll(() => {
    nock.restore()
  })

  beforeEach(() => {
    scheduler = new Scheduler(_services.log, new MemoryLevel(), {
      scheduler: true,
      schedulerFrequency: 500,
    })
    hub = new NotifierHub(_services)
    notifier = new WebhookNotifier(hub, {
      ..._services,
      scheduler,
    })
  })

  it('should post a notification', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/json')
      .post(/ok\/.+/)
      .reply(200)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    await notifier.notify(subOk, notification)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should post an XML notification', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/xml')
      .post(/ok\/.+/, /<sender>w123<\/sender>/gi)
      .reply(200)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    const xmlNotifyMsg = {
      ...notification,
      metadata: {
        ...notification.metadata,
        subscriptionId: 'ok:xml',
      },
    }
    await notifier.notify(subOkXml, xmlNotifyMsg)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should post a notification with bearer auth', async () => {
    const scope = nock('http://localhost', {
      reqheaders: { Authorization: 'Bearer ' + authToken },
    })
      .post(/ok\/.+/)
      .reply(200)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    await notifier.notify(subOkAuth, notification)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should fail posting to the wrong path', async () => {
    const scope = nock('http://localhost').post(/.+/).reply(404)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    await notifier.notify(subFail, notification)

    expect(ok).not.toHaveBeenCalled()
    scope.done()
  })

  it('should re-schedule after exhausting retries', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .times(2)
      .reply(500)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    await notifier.notify(subOk, notification)

    expect(ok).not.toHaveBeenCalled()
    expect((await scheduler.allTaskTimes()).length).toBe(1)

    scope.done()
  })

  it('should retry a notification', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .reply(500)
      .post(/ok\/.+/)
      .reply(200)

    const ok = jest.fn()
    notifier.on('telemetryNotify', ok)

    await notifier.notify(subOk, notification)

    expect(ok).toHaveBeenCalled()

    scope.done()
  })
})
