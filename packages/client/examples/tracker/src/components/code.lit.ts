import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import Prism from 'prismjs';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { TwElement } from '../base/tw.lit';
import { tw } from '../style.js';

@customElement('code-block')
export class CodeBlock extends TwElement {
  @property()
    lang: string;

  @property()
    code: string;

  renderCode() {
    return unsafeHTML(Prism.highlight(this.code, Prism.languages.javascript, 'json'));
  }

  render() {
    return html`
      <style>
  :host {
    --hl-color-string:      #fff;
    --hl-color-function:    #e6db74;
    --hl-color-number:      #ffff00;
    --hl-color-operator:    #f8f8f2;
    --hl-color-class-name:  #e6db74;
    --hl-color-punctuation: #66d9ef;
    --hl-color-keyword:     #ec536d;
    --hl-color-comment:     #8292a2;
    --hl-color-tag:         #f92672;
    --hl-color-selector:    #a6e22e;
    --hl-color-property:    #a6e22e;
  
  }
  
  .litcode {
	overflow: auto;
  white-space:pre-wrap;
  color: #ffff00;
	text-shadow: 0 1px 1px #000;

	direction: ltr;
	text-align: left;
	border: 0;
	tab-size: 4;
  max-width: inherit;
  max-height: inherit;
  width: 100%;
  height: 100%;
  }
  
  .litcode .token.string      { color: var(--hl-color-string);      }
  .litcode .token.function    { color: var(--hl-color-function);    }
  .litcode .token.number      { color: var(--hl-color-number);      }
  .litcode .token.operator    { color: var(--hl-color-operator);    }
  .litcode .token.class-name  { color: var(--hl-color-class-name);  }
  .litcode .token.punctuation { color: var(--hl-color-punctuation); }
  .litcode .token.keyword     { color: var(--hl-color-keyword);     }
  .litcode .token.comment     { color: var(--hl-color-comment);     }
  .litcode .token.tag         { color: var(--hl-color-tag);         }
  .litcode .token.selector    { color: var(--hl-color-selector);    }
  .litcode .token.property    { color: var(--hl-color-property);    }
      </style>
      <pre class="${tw`text-xs bg-gray-700 break-all leading-5 py-4 max-h-96 py-4 px-6`} litcode">${this.renderCode()}</pre>`;
  }
}
