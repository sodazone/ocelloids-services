import { catchError, EMPTY, from, map } from 'rxjs'
import { asJSON } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { RxSubscriptionWithId } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { AgentRuntimeContext } from '../types.js'
import { HYPERBRIDGE_CONFIG } from './config.js'
import { extractSubstrateRequest } from './ops/requests.js'
import { SubstrateIsmpQueryRequest } from './types.js'

export class HyperbridgeTracker {
  readonly #id = 'hyperbridge-tracker'
  readonly #log: Logger
  readonly #ingress: Pick<IngressConsumers, 'evm' | 'substrate'>
  readonly #shared: SubstrateSharedStreams
  readonly #chains: { substrate: NetworkURN[]; evm: NetworkURN[] }
  readonly #streams: {
    in: RxSubscriptionWithId[]
    out: RxSubscriptionWithId[]
  } = { in: [], out: [] }

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#ingress = {
      evm: ctx.ingress.evm,
      substrate: ctx.ingress.substrate,
    }
    this.#shared = SubstrateSharedStreams.instance(this.#ingress.substrate)
    this.#chains = {
      substrate: HYPERBRIDGE_CONFIG.networks.substrate.filter((n) =>
        this.#ingress.substrate.isNetworkDefined(n),
      ),
      evm: HYPERBRIDGE_CONFIG.networks.evm.filter((n) => this.#ingress.evm.isNetworkDefined(n)),
    }
  }

  start() {
    this.#log.info('[%s] start evm=(%s) substrate=(%s)', this.#id, this.#chains.evm, this.#chains.substrate)
    this.#monitorPostRequest()
    // monitor post req (outbound) -> postreq event -> fetch body -> try to decode as TokenGateway body
    // monitor token TokenGateway teleport + received
    // monitor post req handled (inbound)
  }

  stop() {
    this.#log.info('[%s] stop', this.#id)
    Object.values(this.#streams).forEach((streams) => streams.forEach(({ sub }) => sub.unsubscribe()))
  }

  #monitorPostRequest() {
    if (this.#streams.in.length > 0) {
      throw new Error('Inbound streams already open')
    }

    const subs: RxSubscriptionWithId[] = []

    try {
      for (const substrateChain of this.#chains.substrate) {
        subs.push({
          id: substrateChain,
          sub: this.#shared
            .blockEvents(substrateChain)
            .pipe(
              extractSubstrateRequest(this.#getIsmpRequest(substrateChain)),
              catchError((err) => {
                this.#log.error(
                  err,
                  '[%s] %s error on hyperbridge Substrate post request stream',
                  this.#id,
                  substrateChain,
                )
                return EMPTY
              }),
            )
            .subscribe((msg) => {
              console.log('REQ SUBSTRATE', msg)
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

  #getIsmpRequest(chainId: NetworkURN) {
    return (commitment: HexString) => {
      return from(
        this.#ingress.substrate.rpcCall<SubstrateIsmpQueryRequest[]>(chainId, 'ismp_queryRequests', [
          asJSON([{ commitment }]),
        ]),
      ).pipe(map((res) => res[0].Post))
    }
  }
}
