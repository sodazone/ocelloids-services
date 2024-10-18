import { NetworkConfiguration, ServiceConfiguration } from '../config.js'
import { Logger } from '../types.js'
import { ApiClient } from './client.js'

/**
 * Handles substrate network connections.
 */
export default class Connector {
  readonly #log: Logger
  readonly #chains: Record<string, ApiClient> = {}

  constructor(log: Logger, { networks }: ServiceConfiguration) {
    this.#log = log

    for (const network of networks) {
      if (this.#chains[network.id] !== undefined) {
        continue
      }

      log.info('Register network: %s', network.id)

      this.registerNetwork(network)
    }
  }

  private registerNetwork(network: NetworkConfiguration) {
    const { id, provider } = network

    this.#log.info('Register WS provider: %s', id)
    this.#chains[id] = new ApiClient(this.#log, id, provider.url)
  }

  connect(): Record<string, ApiClient> {
    this.#log.info('Connect clients')

    for (const [chain, client] of Object.entries(this.#chains)) {
      client
        .connect()
        .then(() => {
          this.#log.info('Client connected: %s', chain)
        })
        .catch((error) => {
          this.#log.error(error, 'Client failed to connect: %s', chain)
        })
    }

    return this.#chains
  }

  async disconnect() {
    for (const client of Object.values(this.#chains)) {
      client.disconnect()
    }

    this.#log.info('Closing connections: OK')
  }
}
