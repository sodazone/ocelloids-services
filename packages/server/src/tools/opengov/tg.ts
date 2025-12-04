import { Telegraf } from 'telegraf'
import { Gov2Template } from '@/services/egress/messaging/templates/gov2.js'
import { TemplateRenderer } from '@/services/egress/template.js'

export function makeTelegramBot() {
  const token = process.env.TELEGRAM_DEFAULT_BOT_TOKEN
  if (!token) {
    return null
  }
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID is not set')
  }
  const bot = new Telegraf(token)
  const renderer = new TemplateRenderer()

  return {
    send(message: any) {
      const msg = renderer.render({ template: Gov2Template, data: message })
      bot.telegram.sendMessage(chatId, msg, {
        parse_mode: 'MarkdownV2',
        link_preview_options: {
          is_disabled: true,
        },
      })
    },
  }
}
