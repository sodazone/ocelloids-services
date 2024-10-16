import fs from 'node:fs'

import { NetworkConfiguration, ServiceConfiguration } from '../config.js'
import { Logger } from '../types.js'
import { PapiClient } from './client.js'

/**
 * Handles substrate network connections,
 * with support for light clients.
 */
export default class Connector {
  readonly #log: Logger
  readonly #config: ServiceConfiguration
  readonly #chains: Record<string, PapiClient> = {}

  constructor(log: Logger, config: ServiceConfiguration) {
    this.#log = log
    this.#config = config

    const { networks } = config

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
    this.#chains[id] = new PapiClient(provider.url)
  }

  connect(): Record<string, PapiClient> {
    this.#log.info('Connect providers')

    for (const [chain, client] of Object.entries(this.#chains)) {
      client.connect().then(() => {
        this.#log.info('connected: [%s]', chain)
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
