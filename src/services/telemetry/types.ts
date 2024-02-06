import type { Header } from '@polkadot/types/interfaces';

import { XcmReceived, XcmSent } from 'services/monitoring/types.js';
import { TypedEventEmitter } from 'services/types.js';

export type NotifyTelemetryMessage = {
    type: string,
    subscription: string,
    origin: string,
    destination: string,
    outcome: string,
    sink: string,
    error?: string
  }

export type TelemetryNotifierEvents = {
  notify: (msg: NotifyTelemetryMessage) => void,
  notifyError: (msg: NotifyTelemetryMessage) => void
};

export const TelemetryNotifierEventKeys: Array<keyof TelemetryNotifierEvents> = ['notify', 'notifyError'];

export type TelemetryEvents = {
  inbound: (message: XcmReceived) => void,
  outbound: (message: XcmSent) => void,
  matched: (inMsg: XcmReceived, outMsg: XcmSent) => void,
  blockSeen: (msg: {chainId: string, header: Header}) => void,
  blockFinalized: (msg: {chainId: string, header: Header}) => void,
  blockCacheHit: (msg: {chainId: string}) => void
} & TelemetryNotifierEvents;

export type TelemetryEventEmitter = TypedEventEmitter<TelemetryEvents>;
