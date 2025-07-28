import { ClientId, NetworkConfiguration, ServiceConfiguration, clientIds } from '../config.js'
import { Logger, NetworkURN } from '../types.js'
import { BitcoinApi as BitcoinClient } from './bitcoin/client.js'
import { SubstrateClient } from './substrate/index.js'
import { ApiClient } from './types.js'

const INC_CONNECTION_MILLIS = 100

/**
 * Handles substrate network connections.
 */
export default class Connector {
  readonly #log: Logger
  readonly #config: ServiceConfiguration
  readonly #chains: Map<ClientId, Record<string, ApiClient>>

  constructor(log: Logger, config: ServiceConfiguration) {
    this.#log = log
    this.#chains = new Map()
    this.#config = config

    for (const clientId of clientIds) {
      for (const network of config.networks[clientId]) {
        if (this.#chains.has(clientId) && this.#chains.get(clientId)![network.id] !== undefined) {
          continue
        }

        log.info('Register network: %s', network.id)

        this.registerNetwork(clientId, network)
      }
    }
  }

  private registerNetwork(client: ClientId, network: NetworkConfiguration) {
    const { id, provider } = network

    this.#log.info('[connector] Register RPC client: %s (%s)', id, client)

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

  replaceNetwork<T extends ApiClient>(client: ClientId, chainId: NetworkURN): T {
    const cfg = this.#config[client].find(({ id }) => chainId === id)
    if (cfg) {
      this.registerNetwork(client, cfg)
    }
    const api = this.#chains.get(client)?.[chainId]
    if (api) {
      return api as T
    }
    throw new Error(`Unable to get client API ${client} ${chainId}`)
  }

  connectAll<T extends ApiClient>(clientId: ClientId): Record<string, T> {
    const chains = this.#chains.get(clientId) ?? {}

    this.#log.info('[connector] %s connect clients: %j', clientId, Object.keys(chains))

    let i = 0
    for (const [chain, client] of Object.entries(chains)) {
      this.#log.info('[connector:%s] connecting...', chain)

      i++
      setTimeout(() => {
        client
          .connect()
          .then(() => {
            this.#log.info('[connector:%s] connected', chain)
          })
          .catch((error) => {
            this.#log.error(error, '[connector:%s] failed to connect: %s', chain)
          })
      }, i * INC_CONNECTION_MILLIS)
    }

    return chains as Record<string, T>
  }

  async disconnectAll() {
    const clients = new Array(...this.#chains.values()).flatMap((v) => Object.values(v))
    for (const client of clients) {
      await client.disconnect()
    }

    this.#log.info('Closing connections: OK')
  }
}
