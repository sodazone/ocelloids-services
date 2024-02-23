import { PropertyValues, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators.js';
import { animate, fadeIn, fadeOut } from '@lit-labs/motion';

import { XcmNotifyMessage } from '../../../../dist/xcmon-client.js';

import './journey.lit.js';
import { OcelloidsElement } from '../base/ocelloids.lit.js';
import { XcmJourney, mergeJourney, toJourneyId } from '../lib/journey.js';
import { tw } from '../style.js';
import { IconPulse } from '../icons/index.js';

@customElement('oc-subscription')
export class Subscription extends OcelloidsElement {
  @property() id: string;

  @state()
  private journeys : Record<string, XcmJourney> = {};

  @state()
  private ws?: WebSocket;

  constructor() {
    super();
  }

  async onMessage(xcm: XcmNotifyMessage) {
    console.log('XCM', xcm);

    const id = await toJourneyId(xcm);
    const journey = this.journeys[id];

    this.journeys[id] = await mergeJourney(xcm, journey);

    this.requestUpdate();
  }

  renderJourneys() {
    const journeys = Object.values(this.journeys).reverse();
    return journeys.length > 0
      ? html`
        <ul>
        ${repeat(journeys, j => j.id, j => html`
          <li ${animate({
    keyframeOptions: {
      duration: 500,
      delay: 100,
      fill: 'both',
    },
    in: fadeIn,
    out: fadeOut
  })}>
            <oc-journey class=${tw`flex w-full`} .data=${j}>
            </oc-journey>
          </li>
        `)}
        </ul>`
      : html`<div class=${tw`flex items-center space-x-2 p-4`}>
          ${IconPulse()} <span class=${tw`text-sm text-gray-500`}>waiting for events…</span>
        </div>`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#reset();
  }

  shouldUpdate(props: PropertyValues<this>) {
    if (props.get('id') !== undefined && props.get('id') !== this.id) {
      this.#reset();
    }
    return true;
  }

  render() {
    if (this.ws === undefined) {
      console.log('open ws');

      this.journeys = {};
      this.ws = this.client.subscribe(this.id, {
        onMessage: this.onMessage.bind(this)
      });
    }

    return html`
    <div class=${tw`flex flex-col w-full space-y-4 divide-y divide-gray-800 border-x border-gray-900`}>
      ${this.renderJourneys()}
    </div>`;
  }

  #reset() {
    if (this.ws) {
      console.log('close ws');

      this.ws.close(1000, 'bye');
      this.ws = undefined;
    }
  }
}