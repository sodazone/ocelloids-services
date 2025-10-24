import { Observable, Subject } from 'rxjs'
import { ClientId, ServiceConfiguration } from '@/services/config.js'
import { Logger, NetworkURN } from '@/services/index.js'
import Connector from '@/services/networking/connector.js'
import { ApiClient, ApiOps, NeutralHeader } from '@/services/networking/types.js'

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

  override connectAll<T extends ApiClient>(clientId: ClientId): Record<string, T> {
    this.#chains = super.connectAll<T>(clientId)

    if (clientId !== 'substrate') {
      return this.#chains as Record<string, T>
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

    return this.#chains as Record<string, T>
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
