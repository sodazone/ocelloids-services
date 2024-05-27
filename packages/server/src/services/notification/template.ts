import Handlebars, { TemplateDelegate } from 'handlebars'
import { LRUCache } from 'lru-cache'

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
  }

  render<T>(context: RenderContext<T>): string {
    // TODO: consider try..catch wrapping a RendererError
    return this.#resolve(context)(Object.freeze(toDataObject(context.data)), {
      allowProtoMethodsByDefault: false,
      allowCallsToHelperMissing: false,
      allowProtoPropertiesByDefault: false,
    })
  }

  #resolve<T>({ template }: RenderContext<T>): TemplateDelegate<any> {
    if (this.#cache.has(template)) {
      return this.#cache.get(template)!
    }
    const delgate = Handlebars.compile(template, {
      strict: true,
      knownHelpersOnly: true,
    })
    this.#cache.set(template, delgate)
    return delgate
  }
}
