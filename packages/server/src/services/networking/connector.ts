import { ClientId, clientIds, NetworkConfiguration, ServiceConfiguration } from '../config.js'
import { Logger, NetworkURN } from '../types.js'
import { BitcoinApi } from './bitcoin/client.js'
import { EvmApi } from './evm/client.js'
import { SubstrateApi, SubstrateClient } from './substrate/index.js'

const INC_CONNECTION_MILLIS = 100

interface ClientMap {
  bitcoin: BitcoinApi
  substrate: SubstrateApi
  evm: EvmApi
}

/**
 * Handles blockchain network connections.
 */
export default class Connector {
  readonly #log: Logger
  readonly #config: ServiceConfiguration
  readonly #chains: Map<ClientId, Record<string, ClientMap[ClientId]>>

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
        chainRecord[id] = new BitcoinApi(this.#log, id, provider.url)
        break
      case 'substrate':
        chainRecord[id] = new SubstrateClient(this.#log, id, provider.url)
        break
      case 'evm':
        chainRecord[id] = new EvmApi(this.#log, id, provider.url)
        break
    }
  }

  replaceNetwork<C extends ClientId>(client: C, chainId: NetworkURN): ClientMap[C] {
    const cfg = this.#config[client].find(({ id }) => chainId === id)
    if (cfg) {
      this.registerNetwork(client, cfg)
    }
    const api = this.#chains.get(client)?.[chainId]
    if (api) {
      return api as ClientMap[C]
    }
    throw new Error(`Unable to get client API ${client} ${chainId}`)
  }

  connectAll<C extends ClientId>(clientId: C): Record<string, ClientMap[C]> {
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

    return chains as Record<string, ClientMap[C]>
  }

  async disconnect(client: ClientId, chainId: NetworkURN) {
    const api = this.#chains.get(client)?.[chainId]
    if (api) {
      await api.disconnect()
    }
  }

  async disconnectAll() {
    const clients = new Array(...this.#chains.values()).flatMap((v) => Object.values(v))
    for (const client of clients) {
      await client.disconnect()
    }

    this.#log.info('Closing connections: OK')
  }
}
