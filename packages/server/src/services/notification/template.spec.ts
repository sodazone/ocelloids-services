import { LRUCache } from 'lru-cache';
import { TemplateRenderer } from './template.js';

const msg = {
  subscriptionId: 'ok',
  origin: {
    chainId: '0',
  },
};

describe('templates', () => {
  const renderer = new TemplateRenderer();

  it('should render a simple context', () => {
    expect(
      renderer.render({
        template: 'hi {{name}}',
        data: {
          name: 'Moncho',
        },
      })
    ).toBe('hi Moncho');
  });

  it('should render a simple array context', () => {
    expect(
      renderer.render({
        template: '{{#each .}}{{name}}{{nums.length}}{{/each}}',
        data: [
          {
            name: 'Patricio',
            nums: [0, 1, 2],
          },
          {
            name: 'Moncho',
            nums: [3, 4, 5],
          },
        ],
      })
    ).toBe('Patricio3Moncho3');
  });

  it('should throw a renderer exception on unknown properties', () => {
    expect(() =>
      renderer.render({
        template: '{{fail}}',
        data: { id: 0 },
      })
    ).toThrow();
  });

  it('should render using cached templates', () => {
    const cache = new LRUCache<string, any>({
      max: 5,
    });
    const r = new TemplateRenderer(cache);
    for (let i = 0; i < 10; i++) {
      expect(
        r.render({
          template: 'hi {{name}}',
          data: {
            name: 'Moncho' + i,
          },
        })
      ).toBe('hi Moncho' + i);
    }
    expect(cache.size).toBe(1);
  });

  it('should render using cached templates with eviction', () => {
    const cache = new LRUCache<string, any>({
      max: 2,
    });
    const r = new TemplateRenderer(cache);
    for (let i = 0; i < 10; i++) {
      const p = i % 3;
      expect(
        r.render({
          template: 'hi {{name}}' + p,
          data: {
            name: 'Moncho' + i,
          },
        })
      ).toBe(`hi Moncho${i}${p}`);
    }
    expect(cache.size).toBe(2);
  });

  it('should render an xcm matched', () => {
    expect(
      renderer
        .render({
          template: `{
          "a": "{{msg.subscriptionId}}",
          "b": "{{msg.origin.chainId}}"
        }`,
          data: {
            msg,
          },
        })
        .replace(/[\s\n]+/g, '')
    ).toBe('{"a":"ok","b":"0"}');
  });
});
