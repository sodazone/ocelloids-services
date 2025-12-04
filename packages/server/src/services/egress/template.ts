import Handlebars, { TemplateDelegate } from 'handlebars'
import { LRUCache } from 'lru-cache'
import { humanizeTime } from '@/common/time.js'
import { chainHelper } from './helpers.js'
import { escapeMarkdownV2 } from './messaging/escape.js'

type RenderContext<T> = {
  template: string
  data: T
}

type DataObject = {
  [key: string]: any
}

function toDataObject(obj: any): DataObject {
  let dao: DataObject

  if (Array.isArray(obj)) {
    dao = obj.map((it) => toDataObject(it))
  } else if (obj instanceof Object && !(obj instanceof Function)) {
    dao = {}
    for (const [key, value] of Object.entries(obj)) {
      if (Object.hasOwn(obj, key)) {
        dao[key] = toDataObject(value)
      }
    }
  } else {
    dao = obj
  }

  return dao
}

const MAX_TEMPLATE_LENGTH = 10_000

/**
 * Renders Handlebars templates.
 *
 * The renderer keeps an LRU cache of the compiled templates.
 */
export class TemplateRenderer {
  #cache

  constructor(cache?: LRUCache<string, TemplateDelegate>) {
    this.#cache =
      cache ??
      new LRUCache<string, TemplateDelegate>({
        max: 100,
        ttl: 3.6e6, // 1 hour
      })
    Handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2)
    })
    Handlebars.registerHelper('safe', (context) => new Handlebars.SafeString(context))
    Handlebars.registerHelper('eq', (a, b) => a === b)
    Handlebars.registerHelper('chain', chainHelper)
    Handlebars.registerHelper('escapeMarkdownV2', escapeMarkdownV2)
    Handlebars.registerHelper('humanizeTime', (value) => {
      if (!value) {
        return ''
      }

      const date = value instanceof Date ? value : new Date(value)
      if (isNaN(date.getTime())) {
        return ''
      }

      return humanizeTime(date)
    })
  }

  render<T>(context: RenderContext<T>): string {
    try {
      return this.#resolve(context)(Object.freeze(toDataObject(context.data)), {
        allowProtoMethodsByDefault: false,
        allowCallsToHelperMissing: false,
        allowProtoPropertiesByDefault: false,
      })
    } catch (error) {
      throw new Error('Template rendering failed', { cause: error })
    }
  }

  #resolve<T>({ template }: RenderContext<T>): TemplateDelegate<any> {
    if (template.length > MAX_TEMPLATE_LENGTH) {
      throw new Error(`Template too large: ${template.length} characters (max ${MAX_TEMPLATE_LENGTH})`)
    }

    if (this.#cache.has(template)) {
      return this.#cache.get(template)!
    }

    const delgate = Handlebars.compile(template, {
      strict: true,
      knownHelpers: {
        json: true,
        safe: true,
        chain: true,
        eq: true,
        escapeMarkdownV2: true,
        humanizeTime: true,
      },
      knownHelpersOnly: true,
    })

    this.#cache.set(template, delgate)

    return delgate
  }
}
