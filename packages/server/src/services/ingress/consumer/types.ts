import { NetworkURN } from '@/lib.js'
import { BitcoinIngressConsumer } from '@/services/networking/bitcoin/ingress/types.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

export interface IngressConsumer extends TelemetryEventEmitter {
  isNetworkDefined(chainId: NetworkURN): boolean
  getChainIds(): NetworkURN[]
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}

export type IngressConsumers = {
  substrate: SubstrateIngressConsumer
  bitcoin: BitcoinIngressConsumer
}
