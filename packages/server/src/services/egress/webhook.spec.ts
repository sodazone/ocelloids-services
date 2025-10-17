import { MemoryLevel } from 'memory-level'
import nock from 'nock'
import { Scheduler } from '@/services/scheduling/scheduler.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { createServices } from '@/testing/services.js'
import { LevelDB, Services } from '../types.js'
import { hmac256 } from './hmac.js'
import { Egress } from './hub.js'
import { Message } from './types.js'
import { WebhookPublisher } from './webhook.js'

const destinationContext = {
  blockHash: '0xBEEF',
  blockNumber: '2',
  chainId: 'urn:ocn:local:1',
  event: {},
  outcome: 'Success',
  error: null,
  messageHash: '0xCAFE',
  instructions: '0x',
  messageData: '0x',
}

const message: Message = {
  metadata: {
    type: 'xcm.ok',
    agentId: 'xcm',
    subscriptionId: 'ok',
    networkId: 'urn:ocn:local:0',
    timestamp: 123,
  },
  payload: {
    type: 'xcm.ok',
    subscriptionId: 'ok',
    legs: [{ type: 'hrmp', from: 'urn:ocn:local:0', to: 'urn:ocn:local:1' }],
    waypoint: {
      ...destinationContext,
      legIndex: 0,
    },
    destination: destinationContext,
    origin: {
      blockHash: '0xBEEF',
      blockNumber: '2',
      chainId: 'urn:ocn:local:0',
      event: {},
      outcome: 'Success',
      error: null,
      messageHash: '0xCAFE',
      instructions: '0x',
      messageData: '0x',
    },
    sender: { signer: { id: 'w123', publicKey: '0x0' }, extraSigners: [] },
  },
}

const subOk = {
  id: 'ok',
  agent: 'xcm',
  owner: 'unknown',
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
      <xcmStatusEvent type="{{metadata.type}}" subscriptionId="{{metadata.subscriptionId}}" outcome="{{payload.waypoint.outcome}}">
        <origin block="{{payload.origin.blockHash}}">{{payload.origin.chainId}}</origin>
        <destination>{{payload.destination.chainId}}</destination>
        <sender>{{payload.sender.signer.id}}</sender>
        {{#if payload.waypoint.error}}
        <error>{{payload.waypoint.error}}</error>
        {{/if}}
      </xcmStatusEvent>
    </notify>
</paymentService>
`
const subOkXml = {
  id: 'ok:xml',
  agent: 'xcm',
  owner: 'unknown',
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
  owner: 'unknown',
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
  owner: 'unknown',
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

const secret = 'abracadabra'
const subOkSecret = {
  id: 'ok:secret',
  agent: 'xcm',
  owner: 'unknown',
  channels: [
    {
      type: 'webhook',
      url: 'http://localhost/ok',
      secret,
    },
  ],
  args: {
    origin: 'urn:ocn:local:0',
    destinations: ['urn:ocn:local:3000'],
    senders: '*',
    events: '*',
  },
} as Subscription

describe('webhook publisher', () => {
  let subs
  let scheduler: Scheduler
  let publisher: WebhookPublisher
  let egress: Egress
  let services: Services

  beforeAll(async () => {
    services = createServices()
    subs = services.subsStore

    await subs.insert(subOk)
    await subs.insert(subOkXml)
    await subs.insert(subFail)
    await subs.insert(subOkAuth)
    await subs.insert(subOkSecret)
  })

  afterAll(() => {
    nock.restore()
  })

  beforeEach(() => {
    scheduler = new Scheduler(services.log, new MemoryLevel() as LevelDB, {
      scheduler: true,
      schedulerFrequency: 500,
    })
    egress = new Egress(services)
    publisher = new WebhookPublisher(egress, {
      ...services,
      scheduler,
    })
  })

  it('should post a message', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/json')
      .post(/ok\/.+/)
      .reply(200)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    await publisher.publish(subOk, message)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should post an XML message', async () => {
    const scope = nock('http://localhost')
      .matchHeader('content-type', 'application/xml')
      .post(/ok\/.+/, /<sender>w123<\/sender>/gi)
      .reply(200)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    const xmlNotifyMsg = {
      ...message,
      metadata: {
        ...message.metadata,
        subscriptionId: 'ok:xml',
      },
    }
    await publisher.publish(subOkXml, xmlNotifyMsg)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should sign a message with secret', async () => {
    let signature: string | null = null
    let requestBoddy: string | null = null

    const scope = nock('http://localhost', {
      reqheaders: {
        'x-oc-signature-256': (value) => {
          signature = value
          return true
        },
      },
    })
      .post(/ok\/.+/, (body) => {
        requestBoddy = JSON.stringify(body)
        return true
      })
      .reply(200)

    await publisher.publish(subOkSecret, message)

    expect(signature).toBe('V89FS4pHD9/SyLZppL2ESpHgHlkKYt6IQSReACNSYcc=')
    expect(requestBoddy).not.toBeNull()

    expect(await hmac256.verify(secret, signature!, requestBoddy!)).toBe(true)
    expect(await hmac256.verify(secret, signature!, requestBoddy!.substring(1))).toBe(false)

    scope.done()
  })

  it('should post a message with bearer auth', async () => {
    const scope = nock('http://localhost', {
      reqheaders: { Authorization: 'Bearer ' + authToken },
    })
      .post(/ok\/.+/)
      .reply(200)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    await publisher.publish(subOkAuth, message)

    expect(ok).toHaveBeenCalled()
    scope.done()
  })

  it('should fail posting to the wrong path', async () => {
    const scope = nock('http://localhost').post(/.+/).reply(404)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    await publisher.publish(subFail, message)

    expect(ok).not.toHaveBeenCalled()
    scope.done()
  })

  it('should re-schedule after exhausting retries', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .times(2)
      .reply(500)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    await publisher.publish(subOk, message)

    expect(ok).not.toHaveBeenCalled()
    expect((await scheduler.allTaskTimes()).length).toBe(1)

    scope.done()
  })

  it('should retry on failure', async () => {
    const scope = nock('http://localhost')
      .post(/ok\/.+/)
      .reply(500)
      .post(/ok\/.+/)
      .reply(200)

    const ok = vi.fn()
    publisher.on('telemetryPublish', ok)

    await publisher.publish(subOk, message)

    expect(ok).toHaveBeenCalled()

    scope.done()
  })
})
