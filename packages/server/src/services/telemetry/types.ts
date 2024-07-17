import type { Header } from '@polkadot/types/interfaces'

import { Message } from '@/services/egress/types.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { TypedEventEmitter } from '@/services/types.js'

export type NotifyTelemetryMessage = {
  type: string
  subscription: string
  agent: string
  channel: string
  error?: string
}

export function publishTelemetryFrom(
  type: string,
  channel: string,
  msg: Message,
  error?: string,
): NotifyTelemetryMessage {
  return {
    type,
    subscription: msg.metadata.subscriptionId,
    agent: msg.metadata.agentId,
    channel,
    error,
  }
}

export type TelemetryPublisherEvents = {
  telemetryPublish: (msg: NotifyTelemetryMessage) => void
  telemetryPublishError: (msg: NotifyTelemetryMessage) => void
}

export const TelemetryNotifierEventKeys: Array<keyof TelemetryPublisherEvents> = [
  'telemetryPublish',
  'telemetryPublishError',
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
  telemetryHeadCatcherError: (msg: { chainId: string; method: string }) => void
  telemetryBlockCacheError: (msg: { chainId: string; method: string }) => void
} & TelemetryPublisherEvents &
  TelemetryIngressConsumerEvents &
  TelemetryIngressProducerEvents

export type TelemetryEventEmitter = TypedEventEmitter<TelemetryEvents>
export type TelemetryCollect = (observer: TelemetryEventEmitter) => void
