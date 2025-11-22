import { EventEmitter } from 'node:events'
import { Telegraf } from 'telegraf'

import { Subscription, TelegramNotification } from '@/services/subscriptions/types.js'
import { publishTelemetryFrom } from '@/services/telemetry/types.js'
import { Logger, Services } from '@/services/types.js'

import { Egress } from '../hub.js'
import { TemplateRenderer } from '../template.js'
import { Message, Publisher, PublisherEmitter } from '../types.js'

type BotPool = Map<string, Telegraf>

const DEFAULT_TEMPLATE = `
{{metadata.type}} from **{{metadata.agentId}}**
\`\`\`
{{json this}}
\`\`\`
`

/**
 * TelegramPublisher
 *
 * - Hybrid mode: uses a platform default bot or subscriber-provided token.
 * - Renders messages via TemplateRenderer.
 * - Emits telemetry events for success/failure.
 */
export class TelegramPublisher extends (EventEmitter as new () => PublisherEmitter) implements Publisher {
  #log: Logger
  #renderer: TemplateRenderer
  #bots: BotPool
  #defaultToken?: string

  constructor(egress: Egress, { log }: Services) {
    super()

    this.#log = log
    this.#renderer = new TemplateRenderer()
    this.#bots = new Map()
    this.#defaultToken = process.env.TELEGRAM_DEFAULT_BOT_TOKEN

    // TODO: register telegram fastify webhook, to accept incoming messages

    if (!this.#defaultToken) {
      this.#log.warn('[telegram] (!) TELEGRAM_DEFAULT_BOT_TOKEN not set. Subscriber tokens only.')
    }

    egress.on('telegram', this.publish.bind(this))
  }

  #getBot(token: string): Telegraf {
    let bot = this.#bots.get(token)
    if (!bot) {
      bot = new Telegraf(token)
      this.#bots.set(token, bot)
      this.#log.info(`[telegram] new bot instance for token ${token.slice(0, 8)}`)
    }
    return bot
  }

  async publish(sub: Subscription, msg: Message) {
    const { id, channels } = sub

    for (const chan of channels) {
      if (chan.type !== 'telegram') {
        continue
      }

      try {
        await this.#send(chan as TelegramNotification, msg)
      } catch (err) {
        this.#log.error(`[telegram] publish error for sub ${id}: ${(err as Error).message}`)
      }
    }
  }

  async #send(config: TelegramNotification, msg: Message) {
    const { chatId, token, template, parseMode } = config
    const resolvedToken = token ?? this.#defaultToken

    if (!chatId || !resolvedToken) {
      this.#log.warn('[telegram] channel missing chatId or usable token, skipping')
      return
    }

    try {
      const bot = this.#getBot(resolvedToken)
      const rendered =
        template === undefined
          ? this.#renderer.render({ template: DEFAULT_TEMPLATE, data: msg })
          : this.#renderer.render({ template, data: msg })

      const text = typeof rendered === 'string' ? rendered : JSON.stringify(rendered, null, 2)

      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: parseMode ?? 'Markdown',
        link_preview_options: {
          is_disabled: true,
        },
      })

      this.#log.info(`MESSAGE ${msg.metadata.type} agent=${msg.metadata.agentId} chat=${chatId}`)
      this.#telemetryPublish(config, msg)
    } catch (err) {
      this.#log.warn(err, `[telegram] error while sending Telegram message to chat ${chatId}`)
      this.#telemetryPublishError(config, msg)
    }
  }

  #telemetryPublish(config: TelegramNotification, msg: Message) {
    this.emit('telemetryPublish', publishTelemetryFrom(config.type, String(config.chatId), msg))
  }

  #telemetryPublishError(config: TelegramNotification, msg: Message) {
    this.emit(
      'telemetryPublishError',
      publishTelemetryFrom(config.type, String(config.chatId), msg, 'failed'),
    )
  }

  async stop() {
    for (const bot of this.#bots.values()) {
      try {
        bot.stop()
        this.#log.info('[telegram] stop bot')
      } catch (err) {
        this.#log.warn(`[telegram] failed to stop bot: ${(err as Error).message}`)
      }
    }
    this.#bots.clear()
  }
}
