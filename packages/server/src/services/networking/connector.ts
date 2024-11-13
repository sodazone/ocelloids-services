import { ClientId, NetworkConfiguration, ServiceConfiguration } from '../config.js'
import { Logger } from '../types.js'
import { BitcoinApi as BitcoinClient } from './bitcoin/client.js'
import { SubstrateClient } from './substrate/index.js'
import { ApiClient } from './types.js'

/**
 * Handles substrate network connections.
 */
export default class Connector {
  readonly #log: Logger
  readonly #chains: Map<ClientId, Record<string, ApiClient>>

  constructor(log: Logger, { networks }: ServiceConfiguration) {
    this.#log = log
    this.#chains = new Map()

    for (const network of networks) {
      if (this.#chains.has(network.client) && this.#chains.get(network.client)![network.id] !== undefined) {
        continue
      }

      log.info('Register network: %s', network.id)

      this.registerNetwork(network)
    }
  }

  private registerNetwork(network: NetworkConfiguration) {
    const { id, provider, client } = network

    this.#log.info('Register RPC client: %s (%s)', id, client)

    const chainRecord = this.#chains.get(client) ?? this.#chains.set(client, {}).get(client)!

    switch (client) {
      case 'bitcoin':
        chainRecord[id] = new BitcoinClient(this.#log, id, provider.url)
        break
      case 'substrate':
        chainRecord[id] = new SubstrateClient(this.#log, id, provider.url)
        break
    }
  }

  connect<T extends ApiClient>(clientId: ClientId): Record<string, T> {
    this.#log.info('[connector] %s connect clients: %j', clientId, Object.keys(this.#chains))

    const chains = this.#chains.get(clientId) ?? {}

    for (const [chain, client] of Object.entries(chains)) {
      this.#log.info('[connector:%s] connecting...', chain)

      client
        .connect()
        .then(() => {
          this.#log.info('[connector:%s] connected', chain)
        })
        .catch((error) => {
          this.#log.error(error, '[connector:%s] failed to connect: %s', chain)
        })
    }

    return chains as Record<string, T>
  }

  async disconnect() {
    const clients = new Array(...this.#chains.values()).flatMap((v) => Object.values(v))
    for (const client of clients) {
      client.disconnect()
    }

    this.#log.info('Closing connections: OK')
  }
}
