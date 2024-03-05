import { PropertyValues, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators.js';
import { animate, fadeIn, fadeOut } from '@lit-labs/motion';

import { XcmNotifyMessage, Subscription } from '../../../..';

import './journey.lit.js';
import { OcelloidsElement } from '../base/ocelloids.lit.js';
import { XcmJourney, mergeJourney, toJourneyId } from '../lib/journey.js';
import { tw } from '../style.js';
import { IconChain, IconPulse } from '../icons/index.js';
import { trunc } from '../lib/utils.js';
import { sender } from '../lib/mock.js';

@customElement('oc-subscription')
export class SubscriptionElement extends OcelloidsElement {
  @property({
    type: Object,
  })
  subscription: Subscription;

  @state()
  private journeys: Record<string, XcmJourney> = {};

  @state()
  private ws?: WebSocket;

  @property({
    type: Boolean,
  })
  mocked: boolean = false;

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

  renderSubscriptionDetails() {
    return html`
      <div
        class=${tw`flex w-full text-sm items-center space-x-3 text-gray-500 px-4 border-b border-gray-900 divide-x divide-gray-900 bg-gray-900 bg-opacity-80`}
      >
        <div class=${tw`flex flex-col space-y-2 pb-3 items-center`}>
          <span class=${tw`uppercase font-semibold`}>Origin</span>
          <span>${IconChain(this.subscription.origin)}</span>
        </div>
        <div class=${tw`flex flex-col space-y-2 pl-3 pb-3 items-center`}>
          <span class=${tw`uppercase font-semibold`}>Destinations</span>
          <span class=${tw`flex -space-x-1`}> ${this.subscription.destinations.map((d) => IconChain(d))} </span>
        </div>
        <div class=${tw`flex flex-col space-y-2 pl-3 pb-4`}>
          <span class=${tw`uppercase font-semibold`}>Senders</span>
          <span class=${tw`text-gray-200`}>
            ${Array.isArray(this.subscription.senders)
              ? this.subscription.senders.map((s) => trunc(s)).join(',')
              : this.subscription.senders}
          </span>
        </div>
      </div>
    `;
  }

  renderJourneys() {
    const journeys = Object.values(this.journeys).reverse();
    return journeys.length > 0
      ? html` <ul>
          ${repeat(
            journeys,
            (j) => j.id,
            (j) => html`
              <li
                ${animate({
                  keyframeOptions: {
                    duration: 500,
                    delay: 100,
                    fill: 'both',
                  },
                  in: fadeIn,
                  out: fadeOut,
                })}
              >
                <oc-journey class=${tw`flex w-full`} .data=${j}> </oc-journey>
              </li>
            `,
          )}
        </ul>`
      : html` <div class=${tw`flex items-center space-x-2 p-4`}>
          <span class=${tw`text-gray-200 uppercase`}>Waiting for events…</span> ${IconPulse()}
        </div>`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#reset();
  }

  shouldUpdate(props: PropertyValues<this>) {
    if (props.get('subscription') !== undefined && props.get('subscription').id !== this.subscription.id) {
      this.#reset();
    }
    return true;
  }

  render() {
    if (this.ws === undefined) {
      console.log('open ws');

      this.journeys = {};
      this.ws = this.client.subscribe(this.subscription.id, {
        onMessage: this.onMessage.bind(this),
      });

      if (this.mocked) {
        sender(this.onMessage.bind(this));
      }
    }

    return html` <div class=${tw`flex flex-col`}>
      ${this.renderSubscriptionDetails()}
      <div class=${tw`flex flex-col w-full space-y-4 divide-y divide-gray-900`}>
        ${this.renderJourneys()}
      </div>
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
