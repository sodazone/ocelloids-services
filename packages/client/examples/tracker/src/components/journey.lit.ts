import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { animate, fadeInSlow } from '@lit-labs/motion';

import { XcmJourney, XcmJourneyWaypoint } from '../lib/journey.js';
import { tw } from '../style.js';
import { TwElement } from '../base/tw.lit.js';
import { IconSuccess, IconChainFail, IconChainWait, IconArrow, IconChainSuccess, IconWait, IconFail } from '../icons/index.js';

import './code.lit.js';

function trunc(str, len = 11, sep = '…') {
  if (str.length <= len) {return str;}
  const chars = len - sep.length;
  const frontChars = Math.ceil(chars / 2);
  const backChars = Math.floor(chars / 2);

  return str.substr(0, frontChars) + sep + str.substr(str.length - backChars);
}

function inferType({sender, origin, instructions}: XcmJourney) {
  const versioned = Object.values(instructions)[0] as any[];
  const deposit = versioned.find(op => op.DepositAsset !== undefined);

  const X1 = deposit.DepositAsset.beneficiary.interior.X1;
  let beneficiary = 'unknown';
  if (X1?.AccountId32) {
    beneficiary = X1.AccountId32.id;
  } else if (X1?.AccountKey20) {
    beneficiary = X1.AccountKey20.key;
  }

  if (deposit) {
    return html`
      <span class=${tw`text-sm mr-4`}>
        <span class=${tw`text-xs font-medium px-2.5 py-0.5 rounded bg-blue-900 text-blue-300`}>transfer</span>
        from <span class=${tw`text-gray-300`}>${sender ? trunc(sender['Id'] ?? sender) : origin.chainId}</span>
        to <span class=${tw`text-gray-300`}>${trunc(beneficiary)}</span>
      </span>
    `;
  }

  return html`<span></span>`;
}

@customElement('oc-journey')
export class Journey extends TwElement {
  @property({
    type: Object
  }) data: XcmJourney;

  @state()
    selected: XcmJourneyWaypoint;

  iconForOutcome(
    {chainId, outcome}: XcmJourneyWaypoint,
    withChain = true
  ) {
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
      <div class=${tw`flex items-center space-x-4 text-sm`}>
        ${this.iconForOutcome(point)}
        <span>${point.event ? point.event.eventId : point.blockNumber}</span>
      </div>
      <div class=${tw`flex justify-end items-center space-x-4 text-sm`}>
        <span>${point.error && point.error || ''}</span>
        ${this.iconForOutcome(point, false)}
      </div>
    </div>
  `;
  }

  render() {
    const j = this.data;

    return html`<div class=${tw`w-full`}>
    <div class=${tw`w-full flex p-4 justify-between items-center space-x-3 bg-gray-900`}>
      <div class=${tw`flex items-center space-x-2`}>
        <span class=${tw`pr-4 text-sm text-gray-500`}>${inferType(j)}</span>
        ${this.iconForOutcome(j.origin)}
        <span class=${tw`text-gray-700`}>${IconArrow()}</span>
        ${j.stops.map(stop => this.iconForOutcome(stop))}
        ${j.stops.length > 0 && html`<span class=${tw`text-gray-700`}>${IconArrow()}</span>` || ''}
        ${this.iconForOutcome(j.destination)}
      </div>
      <span class=${tw`mr-3 text-xs text-gray-500`}>
       ${j.created}
      </span>
    </div>
    ${this.selected ? html`
      <div @click=${this.clickHandler}
        ${animate({
    in: fadeInSlow,
  })}
      >
        <code-block code=${JSON.stringify(this.selected, null, 2)}></code-block>
      </div>` : ''
}
    <div class=${tw`flex flex-col divide-y divide-gray-900`}>
      ${repeat(
    [j.origin, ...j.stops, j.destination],
    p => j.id + p.chainId + p.outcome,
    p => this.renderStatusRow(p)
  )}
    </div>
    </div>`;
  }
}