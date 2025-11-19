import { from, map, Subject, share, switchMap } from 'rxjs'
import { Abi } from 'viem'
import { HexString } from '@/lib.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../types.js'
import hostAbi from './abis/evm-host.json' with { type: 'json' }
import { getHostContractAddress, HYPERBRIDGE_CONFIG } from './config.js'
import { HyperbridgeMatchingEngine } from './matching.js'
import {
  extractEvmHandlePostRequest,
  extractSubstrateHandleRequestFromCompressedCall,
  extractSubstrateHandleUnsigned,
} from './ops/handle-request.js'
import { extractEvmRequest, extractSubstrateRequest } from './ops/post-request.js'
import {
  HyperbridgeDispatched,
  HyperbridgeMessagePayload,
  IsmpPostRequestHandledWithContext,
  IsmpPostRequestWithContext,
  IsmpQueryRequestRpcResult,
} from './types.js'

export class HyperbridgeTracker {
  readonly #id = 'hyperbridge-tracker'
  readonly #log: Logger
  readonly #ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
  readonly #shared: SubstrateSharedStreams
  readonly #engine: HyperbridgeMatchingEngine
  readonly #subject: Subject<HyperbridgeMessagePayload>

  readonly #chains: { substrate: NetworkURN[]; evm: NetworkURN[] }
  readonly #streams: {
    o: RxSubscriptionWithId[]
    r: RxSubscriptionWithId[]
    d: RxSubscriptionWithId[]
  } = { o: [], r: [], d: [] }

  readonly ismp$

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = {
      evm: ctx.ingress.evm,
      substrate: ctx.ingress.substrate,
    }
    this.#shared = SubstrateSharedStreams.instance(this.#ingress.substrate)

    this.#subject = new Subject<HyperbridgeMessagePayload>()
    this.ismp$ = this.#subject.pipe(share())

    this.#engine = new HyperbridgeMatchingEngine(ctx, (msg: HyperbridgeMessagePayload) =>
      this.#subject.next(msg),
    )
    this.#chains = {
      substrate: HYPERBRIDGE_CONFIG.networks.substrate.filter((n) =>
        this.#ingress.substrate.isNetworkDefined(n),
      ),
      evm: HYPERBRIDGE_CONFIG.networks.evm.filter((n) => this.#ingress.evm.isNetworkDefined(n)),
    }
  }

  async start() {
    this.#log.info('[agent:%s] wait APIs ready', this.#id)
    await this.#ingress.substrate.isReady()

    this.#log.info('[%s] start evm=(%s) substrate=(%s)', this.#id, this.#chains.evm, this.#chains.substrate)
    this.#monitorOrigins()
    this.#monitorDestinations()
  }

  stop() {
    this.#log.info('[%s] stop', this.#id)
    Object.values(this.#streams).forEach((streams) => streams.forEach(({ sub }) => sub.unsubscribe()))
  }

  #monitorOrigins() {
    if (this.#streams.o.length > 0) {
      throw new Error('Origin streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    const makeObserver = (chainId: NetworkURN) => ({
      error: (error: any) => {
        this.#log.error(error, '[%s] %s error on origin stream', this.#id, chainId)
      },
      next: (req: IsmpPostRequestWithContext) => {
        if (!this.#canBeMatched(req)) {
          return
        }
        if (req.chainId !== req.source) {
          this.#engine.onRelayMessage(req)
        } else {
          this.#engine.onOutboundMessage(new HyperbridgeDispatched(req))
        }
      },
      complete: () => this.#log.info('[%s] %s complete on origin stream', this.#id, chainId),
    })

    try {
      for (const substrateChain of this.#chains.substrate) {
        subs.push({
          id: substrateChain,
          sub: this.#shared
            .blockEvents(substrateChain)
            .pipe(extractSubstrateRequest(substrateChain, this.#getIsmpRequest(substrateChain)))
            .subscribe(makeObserver(substrateChain)),
        })
      }

      for (const evmChain of this.#chains.evm) {
        subs.push({
          id: evmChain,
          sub: this.#ingress.evm
            .watchEvents(
              evmChain,
              {
                abi: hostAbi as Abi,
                addresses: [getHostContractAddress(evmChain)].filter((a) => a !== null),
              },
              ['PostRequestEvent'],
            )
            .pipe(extractEvmRequest(evmChain))
            .subscribe(makeObserver(evmChain)),
        })
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.o = subs
  }

  #monitorDestinations() {
    if (this.#streams.d.length > 0) {
      throw new Error('Destination streams already open')
    }

    const subs: RxSubscriptionWithId[] = []
    const isRelay = (msg: IsmpPostRequestHandledWithContext) =>
      msg.chainId !== msg.source && msg.chainId !== msg.destination

    const makeObserver = (chainId: NetworkURN) => ({
      error: (error: any) => {
        this.#log.error(error, '[%s] %s error on destination stream', this.#id, chainId)
      },
      next: (msg: IsmpPostRequestHandledWithContext) => {
        if (!this.#canBeMatched(msg)) {
          return
        }
        if (isRelay(msg)) {
          this.#engine.onRelayMessage(msg)
        } else {
          this.#engine.onInboundMessage(msg)
        }
      },
      complete: () => this.#log.info('[%s] %s complete on destination stream', this.#id, chainId),
    })

    try {
      for (const substrateChain of this.#chains.substrate) {
        subs.push({
          id: `${substrateChain}-default`,
          sub: this.#shared
            .blockExtrinsics(substrateChain)
            .pipe(extractSubstrateHandleUnsigned(substrateChain))
            .subscribe(makeObserver(substrateChain)),
        })

        subs.push({
          id: `${substrateChain}-compressed`,
          sub: this.#ingress.substrate
            .getContext(substrateChain)
            .pipe(
              switchMap((context) =>
                this.#shared
                  .blockExtrinsics(substrateChain)
                  .pipe(extractSubstrateHandleRequestFromCompressedCall(substrateChain, context)),
              ),
            )
            .subscribe(makeObserver(substrateChain)),
        })
      }

      for (const evmChain of this.#chains.evm) {
        subs.push({
          id: evmChain,
          sub: this.#ingress.evm
            .finalizedBlocks(evmChain)
            .pipe(
              extractEvmHandlePostRequest(evmChain, (txHash: HexString) =>
                this.#ingress.evm.getTransactionReceipt(evmChain, txHash),
              ),
            )
            .subscribe(makeObserver(evmChain)),
        })
      }
    } catch (error) {
      // Clean up streams.
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }

    this.#streams.d = subs
  }

  #getIsmpRequest(chainId: NetworkURN) {
    return (commitment: HexString) => {
      return from(
        this.#ingress.substrate.rpcCall<IsmpQueryRequestRpcResult[]>(chainId, 'ismp_queryRequests', [
          [{ commitment }],
        ]),
      ).pipe(map((res) => res[0].Post))
    }
  }

  #canBeMatched(req: IsmpPostRequestWithContext) {
    return (
      (this.#chains.evm.includes(req.source) || this.#chains.substrate.includes(req.source)) &&
      (this.#chains.evm.includes(req.destination) || this.#chains.substrate.includes(req.destination))
    )
  }
}
