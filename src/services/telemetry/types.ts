import type { Header } from '@polkadot/types/interfaces';

import { QuerySubscription, XcmMatched, XcmReceived, XcmSent } from 'services/monitoring/types.js';
import { TypedEventEmitter } from 'services/types.js';

export type NotifyTelemetryMessage = {
  type: string,
  subscription: string,
  origin: string,
  destination: string,
  outcome: string,
  channel: string,
  error?: string
}

export function notifyTelemetryFrom(
  type: string,
  channel: string,
  msg: XcmMatched,
  error?: string
) : NotifyTelemetryMessage {
  return {
    type,
    subscription: msg.subscriptionId,
    origin: msg.origin.chainId,
    destination: msg.destination.chainId,
    outcome: msg.destination.outcome,
    channel,
    error
  };
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
  telemetryBlockCacheHit: (msg: {chainId: string}) => void,
  telemetrySocketListener: (ip: string, sub: QuerySubscription, close?: boolean) => void,
} & TelemetryNotifierEvents;

export type TelemetryEventEmitter = TypedEventEmitter<TelemetryEvents>;
