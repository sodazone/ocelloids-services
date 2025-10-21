import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { HexString, RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../../types.js'
import {
  extractSnowbridgeEvmInbound,
  extractSnowbridgeEvmOutbound,
  extractSnowbridgeSubstrateInbound,
  extractSnowbridgeSubstrateOutbound,
} from '../ops/snowbridge.js'
import { MatchingEngine } from './matching.js'

const BRIDGE_HUBS = ['urn:ocn:polkadot:1002']
const GATEWAY_CONTRACTS: Record<NetworkURN, HexString> = {
  'urn:ocn:ethereum:1': '0x27ca963C279c93801941e1eB8799c23f407d68e7',
}

export class SnowbridgeTracker {
  readonly #id = 'snowbridge-tracker'
  readonly #log: Logger

  readonly #streams: {
    in: RxSubscriptionWithId[]
    out: RxSubscriptionWithId[]
  }
  readonly #ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
  readonly #shared: SubstrateSharedStreams
  readonly #engine: MatchingEngine

  constructor(ctx: AgentRuntimeContext, engine: MatchingEngine) {
    this.#log = ctx.log

    this.#streams = { in: [], out: [] }
    this.#ingress = {
      evm: ctx.ingress.evm,
      substrate: ctx.ingress.substrate,
    }
    this.#shared = SubstrateSharedStreams.instance(this.#ingress.substrate)
    this.#engine = engine
  }

  start() {
    const evmChains = this.#ingress.evm.getChainIds()
    const substrateChains = this.#ingress.substrate.getChainIds().filter((id) => BRIDGE_HUBS.includes(id))
    this.#log.info('[%s] start evm=(%s) substrate=(%s)', this.#id, evmChains, substrateChains)
    this.#monitorInbound(evmChains, substrateChains)
    this.#monitorOutbound(evmChains, substrateChains)
  }

  #monitorInbound(evmChainIds: NetworkURN[], substrateChainIds: NetworkURN[]) {
    if (this.#streams.in.length > 0) {
      throw new Error('Inbound streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    try {
      for (const evmChain of evmChainIds) {
        const contractAddress = GATEWAY_CONTRACTS[evmChain]
        if (!contractAddress) {
          this.#log.warn(
            '[%s] Snowbridge gateway contract address not found for chain %s',
            this.#id,
            evmChain,
          )
          continue
        }
        subs.push({
          id: evmChain,
          sub: this.#ingress.evm
            .finalizedBlocks(evmChain)
            .pipe(extractSnowbridgeEvmInbound(evmChain, contractAddress))
            .subscribe({
              error: (error: any) => {
                this.#log.error(error, '[%s] %s error on snowbridge inbound EVM stream', this.#id, evmChain)
                // this.#telemetry.emit()
              },
              next: (msg) => {
                //
              },
            }),
        })
      }

      for (const substrateChain of substrateChainIds) {
        subs.push({
          id: substrateChain,
          sub: this.#shared
            .blockEvents(substrateChain)
            .pipe(extractSnowbridgeSubstrateInbound(substrateChain))
            .subscribe({
              error: (error: any) => {
                this.#log.error(
                  error,
                  '[%s] %s error on snowbridge inbound Substrate stream',
                  this.#id,
                  substrateChain,
                )
                // this.#telemetry.emit()
              },
              next: (msg) => {
                //
              },
            }),
        })
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.in = subs
  }

  #monitorOutbound(evmChainIds: NetworkURN[], substrateChainIds: NetworkURN[]) {
    if (this.#streams.in.length > 0) {
      throw new Error('Inbound streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    try {
      for (const evmChain of evmChainIds) {
        const contractAddress = GATEWAY_CONTRACTS[evmChain]
        if (!contractAddress) {
          this.#log.warn(
            '[%s] Snowbridge gateway contract address not found for chain %s',
            this.#id,
            evmChain,
          )
          continue
        }
        subs.push({
          id: evmChain,
          sub: this.#ingress.evm
            .finalizedBlocks(evmChain)
            .pipe(extractSnowbridgeEvmOutbound(evmChain, contractAddress))
            .subscribe({
              error: (error: any) => {
                this.#log.error(error, '[%s] %s error on origin stream', this.#id, evmChain)
              },
              next: (msg) => {
                this.#engine.onSnowbridgeOriginOutbound(msg)
              },
            }),
        })
      }

      for (const substrateChain of substrateChainIds) {
        subs.push({
          id: substrateChain,
          sub: this.#shared
            .blockEvents(substrateChain)
            .pipe(extractSnowbridgeSubstrateOutbound(substrateChain))
            .subscribe({
              error: (error: any) => {
                this.#log.error(
                  error,
                  '[%s] %s error on snowbridge inbound Substrate stream',
                  this.#id,
                  substrateChain,
                )
                // this.#telemetry.emit()
              },
              next: (msg) => {
                //
              },
            }),
        })
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.in = subs
  }
}
