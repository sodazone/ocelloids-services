import Handlebars, { TemplateDelegate } from 'handlebars';
import { LRUCache } from 'lru-cache';

type RenderContext<T> = {
  template: string,
  data: T
}

/**
 * Renders Handlebars templates.
 *
 * The renderer keeps an LRU cache of the compiled templates.
 */
export class TemplateRenderer {
  #cache;

  constructor(cache?: LRUCache<string, TemplateDelegate>) {
    this.#cache = cache ?? new LRUCache<string, TemplateDelegate>({
      max: 100,
      // TODO maxSize...
    });
  }

  render<T>(context: RenderContext<T>): string {
    return this.#resolve(context)(context.data, {
      allowProtoMethodsByDefault: false,
      allowCallsToHelperMissing: false,
      allowProtoPropertiesByDefault: false
    });
  }

  #resolve<T>({ template }: RenderContext<T>) : TemplateDelegate<T> {
    if (this.#cache.has(template)) {
      return this.#cache.get(template)!;
    }
    const delgate = Handlebars.compile(template, {
      strict: true,
      knownHelpersOnly: true
    });
    this.#cache.set(template, delgate);
    return delgate;
  }
}