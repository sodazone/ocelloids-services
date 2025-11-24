import { Observable, Subject } from 'rxjs'
import { ClientId, ServiceConfiguration } from '@/services/config.js'
import { Logger, NetworkURN } from '@/services/index.js'
import { BitcoinApi } from '@/services/networking/bitcoin/client.js'
import Connector from '@/services/networking/connector.js'
import { EvmApi } from '@/services/networking/evm/client.js'
import { SubstrateApi } from '@/services/networking/substrate/types.js'
import { ApiClient, ApiOps, NeutralHeader } from '@/services/networking/types.js'

interface ClientMap {
  bitcoin: BitcoinApi
  substrate: SubstrateApi
  evm: EvmApi
}

/**
 * InjectableConnector — test double for Connector
 *
 * This mock version replaces `SubstrateClient.followHeads$('finalized')`
 * with a Subject-based stream that can be manually driven using
 * `reportFinalizedBlock(chainId, header)`.
 */
export class InjectableConnector extends Connector {
  #finalizedInjectors = new Map<NetworkURN, Subject<any>>()
  #log: Logger
  #chains: Record<string, ApiClient>

  constructor(log: Logger, config: ServiceConfiguration) {
    super(log, config)
    this.#log = log
    this.#chains = {}
  }

  override connectAll<C extends ClientId>(clientId: C): Record<string, ClientMap[C]> {
    this.#chains = super.connectAll(clientId)

    if (clientId !== 'substrate') {
      return this.#chains as Record<string, ClientMap[C]>
    }

    // Wrap substrate clients with mock finalized stream
    for (const [chainId, client] of Object.entries(this.#chains)) {
      const subj = new Subject<NeutralHeader>()
      this.#finalizedInjectors.set(chainId as NetworkURN, subj)

      // Replace followHeads$('finalized') with the subject observable
      ;(client as ApiOps).followHeads$ = (kind: string): Observable<NeutralHeader> => {
        if (kind === 'finalized') {
          return subj.asObservable()
        }
        throw new Error(`[mock] Unsupported followHeads$ kind: ${kind}`)
      }

      this.#log.info('[mock-connector:%s] Mocked followHeads$("finalized")', chainId)
    }

    return this.#chains as Record<string, ClientMap[C]>
  }

  api(chainId: NetworkURN) {
    return this.#chains[chainId]
  }

  /**
   * Push a synthetic finalized block header into the mock stream.
   */
  reportFinalizedBlock(chainId: NetworkURN, header: NeutralHeader) {
    const subj = this.#finalizedInjectors.get(chainId)
    if (!subj) {
      this.#log.warn('[mock-connector:%s] no mock finalized stream found', chainId)
      return
    }
    this.#log.info(
      '[mock-connector:%s] emitting mock finalized block #%d (%s)',
      chainId,
      header.height,
      header.hash,
    )
    subj.next(header)
  }
}
