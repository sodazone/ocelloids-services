import type { Header } from '@polkadot/types/interfaces'

import { Subscription } from '../monitoring/types.js'
import { NotifyMessage } from '../notification/types.js'
import { TypedEventEmitter } from '../types.js'

export type NotifyTelemetryMessage = {
  type: string
  subscription: string
  agent: string
  channel: string
  error?: string
}

export function notifyTelemetryFrom(
  type: string,
  channel: string,
  msg: NotifyMessage,
  error?: string
): NotifyTelemetryMessage {
  return {
    type,
    subscription: msg.metadata.subscriptionId,
    agent: msg.metadata.agentId,
    channel,
    error,
  }
}

export type TelemetryNotifierEvents = {
  telemetryNotify: (msg: NotifyTelemetryMessage) => void
  telemetryNotifyError: (msg: NotifyTelemetryMessage) => void
}

export const TelemetryNotifierEventKeys: Array<keyof TelemetryNotifierEvents> = [
  'telemetryNotify',
  'telemetryNotifyError',
]

type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info'

export type TelemetryIngressConsumerEvents = {
  telemetryIngressConsumerError: (id: string, severity?: ErrorSeverity) => void
}

export type TelemetryIngressProducerEvents = {
  telemetryIngressProducerError: (id: string, severity?: ErrorSeverity) => void
}

export type TelemetryEvents = {
  telemetryBlockSeen: (msg: { chainId: string; header: Header }) => void
  telemetryBlockFinalized: (msg: { chainId: string; header: Header }) => void
  telemetryBlockCacheHit: (msg: { chainId: string }) => void
  telemetrySocketListener: (ip: string, sub: Subscription, close?: boolean) => void
  telemetrySubscriptionError: (msg: {
    subscriptionId: string
    chainId: string
    direction: 'in' | 'out' | 'relay'
  }) => void
  telemetryHeadCatcherError: (msg: { chainId: string; method: string }) => void
  telemetryBlockCacheError: (msg: { chainId: string; method: string }) => void
} & TelemetryNotifierEvents &
  TelemetryIngressConsumerEvents &
  TelemetryIngressProducerEvents

export type TelemetryEventEmitter = TypedEventEmitter<TelemetryEvents>
export type TelemetryCollect = (observer: TelemetryEventEmitter) => void
