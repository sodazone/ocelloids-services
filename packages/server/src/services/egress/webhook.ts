import { EventEmitter } from 'node:events'

import got from 'got'
import { ulid } from 'ulidx'

import { Subscription, WebhookNotification } from '@/services/subscriptions/types.js'
import { Logger, Services } from '@/services/types.js'
import version from '@/version.js'

import { Scheduled, Scheduler, SubsStore } from '@/services/persistence/level/index.js'
import { publishTelemetryFrom } from '@/services/telemetry/types.js'
import { hmac256 } from './hmac.js'
import { Egress } from './hub.js'
import { TemplateRenderer } from './template.js'
import { Message, Publisher, PublisherEmitter } from './types.js'

const DEFAULT_DELAY = 300000 // 5 minutes

type WebhookTask = {
  id: string
  subId: string
  agentId: string
  msg: Message
}
const WebhookTaskType = 'task:webhook'

function buildPostUrl(url: string, id: string) {
  return [url, id].join('/').replace(/([^:]\/)\/+/g, '$1')
}

/**
 * Reliable message delivery to webhooks.
 *
 * Features:
 * - Immediate and scheduled retry logic.
 * - Text templates for the body payload.
 */
export class WebhookPublisher extends (EventEmitter as new () => PublisherEmitter) implements Publisher {
  #log: Logger
  #scheduler: Scheduler
  #subs: SubsStore
  #renderer: TemplateRenderer

  constructor(egress: Egress, { log, scheduler, subsStore }: Services) {
    super()

    this.#log = log
    this.#scheduler = scheduler
    this.#subs = subsStore
    this.#renderer = new TemplateRenderer()

    this.#scheduler.on(WebhookTaskType, this.#dispatch.bind(this))

    egress.on('webhook', this.publish.bind(this))
  }

  async publish(sub: Subscription, msg: Message) {
    const { id, agent, channels } = sub

    for (const chan of channels) {
      if (chan.type === 'webhook') {
        const taskId = ulid()
        const scheduled: Scheduled<WebhookTask> = {
          type: WebhookTaskType,
          task: {
            id: taskId,
            subId: id,
            agentId: agent,
            msg,
          },
        }
        await this.#dispatch(scheduled)
      }
    }
  }

  async #dispatch(scheduled: Scheduled<WebhookTask>) {
    const {
      task: { subId, agentId },
    } = scheduled

    try {
      const { channels } = await this.#subs.getById(agentId, subId)
      for (const chan of channels) {
        if (chan.type === 'webhook') {
          const config = chan as WebhookNotification
          await this.#post(scheduled, config)
        }
      }
    } catch (error) {
      // do not re-schedule
      this.#log.error(error, 'Webhook dispatch error')
    }
  }

  async #post(scheduled: Scheduled<WebhookTask>, config: WebhookNotification) {
    const {
      task: { id, msg },
    } = scheduled
    const { contentType, url, limit, template } = config
    const postUrl = buildPostUrl(url, id)

    try {
      const res = await got.post<Message>(postUrl, {
        body: template === undefined ? JSON.stringify(msg) : this.#renderer.render({ template, data: msg }),
        headers: {
          'user-agent': 'ocelloids/' + version,
          'content-type': contentType ?? 'application/json',
        },
        retry: {
          limit: limit ?? 5,
          methods: ['POST'],
        },
        context: {
          bearer: config.bearer,
          secret: config.secret,
        },
        hooks: {
          init: [
            (raw, options) => {
              if ('secret' in raw) {
                options.context.secret = raw.secret
                delete raw.secret
              }
              if ('bearer' in raw) {
                options.context.bearer = raw.bearer
                delete raw.bearer
              }
            },
          ],
          beforeRequest: [
            async (options) => {
              const { bearer, secret } = options.context as {
                bearer?: string
                secret?: string
              }
              if (bearer && !options.headers.authorization) {
                options.headers.authorization = `Bearer ${bearer}`
              }
              if (secret) {
                const { body } = options

                if (Buffer.isBuffer(body) || typeof body === 'string') {
                  const signature = await hmac256.sign(secret, body)
                  options.headers['X-OC-Signature-256'] = signature
                }
              }
            },
          ],
        },
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        this.#log.info(
          'MESSAGE %s agent=%s subscription=%s, endpoint=%s',
          msg.metadata.type,
          msg.metadata.agentId,
          msg.metadata.subscriptionId,
          postUrl,
        )
        this.#telemetryPublish(config, msg)
      } else {
        // Should not enter here, since the non success status codes
        // are retryable and will throw an exception when the limit
        // of retries is reached.
        this.#log.error('Not deliverable webhook %s %s', postUrl, id)
      }
    } catch (error) {
      this.#log.warn(error, 'Error while posting to webhook %s', config.url)

      // Re-schedule in 5 minutes
      const time = new Date(Date.now() + DEFAULT_DELAY)
      const key = time.toISOString() + id
      await this.#scheduler.schedule({
        ...scheduled,
        key,
      })
      this.#log.info('Scheduled webhook delivery %s', key)
      this.#telemetryPublishError(config, msg)
    }
  }

  #telemetryPublish(config: WebhookNotification, msg: Message) {
    this.emit('telemetryPublish', publishTelemetryFrom(config.type, config.url, msg))
  }

  #telemetryPublishError(config: WebhookNotification, msg: Message) {
    this.emit('telemetryPublishError', publishTelemetryFrom(config.type, config.url, msg, 'max_retries'))
  }
}
