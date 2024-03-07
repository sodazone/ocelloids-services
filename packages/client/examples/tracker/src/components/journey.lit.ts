import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { animate, fadeInSlow } from '@lit-labs/motion';

import { XcmJourney, XcmJourneyWaypoint } from '../lib/journey.js';
import { tw } from '../style.js';
import { TwElement } from '../base/tw.lit.js';
import {
  IconSuccess,
  IconChainFail,
  IconChainWait,
  IconArrow,
  IconChainSuccess,
  IconWait,
  IconFail,
  BadgeType,
} from '../icons/index.js';
import { HumanizedXcm, humanize } from '../lib/kb.js';

import './code.lit.js';

@customElement('oc-journey')
export class Journey extends TwElement {
  @property({
    type: Object,
  })
  data: XcmJourney;

  @state() selected: XcmJourneyWaypoint;

  iconForOutcome({ chainId, outcome }: XcmJourneyWaypoint, withChain = true) {
    if (outcome === undefined) {
      return withChain ? IconChainWait(chainId) : IconWait();
    } else if (outcome === 'Success') {
      return withChain ? IconChainSuccess(chainId) : IconSuccess();
    } else {
      return withChain ? IconChainFail(chainId) : IconFail();
    }
  }

  clickHandler(e: Event, item: XcmJourneyWaypoint) {
    this.selected = item;
  }

  renderStatusRow(point: XcmJourneyWaypoint) {
    return html`
      <div
        class=${tw`flex w-full items-center justify-between px-6 py-4`}
        @click=${(e: Event) => this.clickHandler(e, point)}
      >
        <div class=${tw`flex items-center space-x-4`}>
          ${this.iconForOutcome(point)}
          <span>${point.event && Object.keys(point.event).length > 0 ? point.event.eventId : point.blockNumber}</span>
        </div>
        <div class=${tw`flex justify-end items-center space-x-4`}>
          <span>${(point.error && point.error) || ''}</span>
          ${this.iconForOutcome(point, false)}
        </div>
      </div>
    `;
  }

  renderHumanized(hxcm: HumanizedXcm) {
    const { type, from, to } = hxcm;

    return html`
      <span class=${tw`mr-4`}>
        ${BadgeType(type)} from <span class=${tw`text-gray-300`}>${from}</span> to
        <span class=${tw`text-gray-300`}>${to}</span>
      </span>
    `;
  }

  render() {
    const j = this.data;

    return html`<div class=${tw`w-full`}>
      <div class=${tw`w-full flex p-4 justify-between items-center space-x-3 bg-gray-900 bg-opacity-80`}>
        <div class=${tw`flex items-center space-x-2`}>
          <span class=${tw`pr-4 text-gray-500`}>${this.renderHumanized(humanize(j))}</span>
          ${this.iconForOutcome(j.origin)}
          <span class=${tw`text-gray-700`}>${IconArrow()}</span>
          ${j.stops.map((stop) => this.iconForOutcome(stop))}
          ${(j.stops.length > 0 && html`<span class=${tw`text-gray-700`}>${IconArrow()}</span>`) || ''}
          ${this.iconForOutcome(j.destination)}
        </div>
        <span class=${tw`mr-3 text-sm text-gray-500`}> ${j.created} </span>
      </div>
      ${this.selected
        ? html` <div
            @click=${this.clickHandler}
            ${animate({
              in: fadeInSlow,
            })}
          >
            <div class=${tw`text-xs px-4 text-gray-500 capitalize bg-gray-700`}>XCM Instructions</div>
            <code-block code=${JSON.stringify(this.selected.instructions, null, 2)}></code-block>
            <div class=${tw`text-xs px-4 text-gray-500 capitalize bg-gray-700 border-gray-600 border-t`}>Waypoint</div>
            <code-block code=${JSON.stringify(this.selected, null, 2)}></code-block>
          </div>`
        : ''}
      <div class=${tw`flex flex-col divide-y divide-gray-900 border-x border-gray-900 bg-gray-900 bg-opacity-50`}>
        ${repeat(
          [j.origin, ...j.stops, j.destination],
          (p) => j.id + p.chainId + p.outcome,
          (p) => this.renderStatusRow(p),
        )}
      </div>
    </div>`;
  }
}
