import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { provide } from '@lit/context';

import { OcelloidsClient } from '../../..';

import './components/subscriptions.lit.js';
import { ocelloidsContext } from './base/ocelloids.ctx.js';
import { TwElement } from './base/tw.lit';

@customElement('tracker-app')
export class TrackerApp extends TwElement {
  @provide({ context: ocelloidsContext }) client;

  constructor() {
    super();

    this.client = new OcelloidsClient({
      httpUrl: 'http://127.0.0.1:3000',
      wsUrl: 'ws://127.0.0.1:3000',
    });
  }

  render() {
    return html`<oc-subscriptions></oc-subscriptions>`;
  }
}
