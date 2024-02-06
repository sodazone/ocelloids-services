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
  telemetryNotify: (msg: NotifyTelemetryMessage) => void,
  telemetryNotifyError: (msg: NotifyTelemetryMessage) => void
};

export const TelemetryNotifierEventKeys: Array<keyof TelemetryNotifierEvents> = ['telemetryNotify', 'telemetryNotifyError'];

export type TelemetryEvents = {
  telemetryInbound: (message: XcmReceived) => void,
  telemetryOutbound: (message: XcmSent) => void,
  telemetryMatched: (inMsg: XcmReceived, outMsg: XcmSent) => void,
  telemetryBlockSeen: (msg: {chainId: string, header: Header}) => void,
  telemetryBlockFinalized: (msg: {chainId: string, header: Header}) => void,
  telemetryBlockCacheHit: (msg: {chainId: string}) => void
} & TelemetryNotifierEvents;

export type TelemetryEventEmitter = TypedEventEmitter<TelemetryEvents>;
