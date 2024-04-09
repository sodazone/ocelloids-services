import fs from 'node:fs';

import { ProviderInterface } from '@polkadot/rpc-provider/types';
import { WsProvider, ScProvider } from '@polkadot/api';
import { config as oconfig, SubstrateApis, Smoldot } from '@sodazone/ocelloids-sdk';

import { NetworkConfiguration, ServiceConfiguration } from '../config.js';
import { Logger } from '../types.js';

/**
 * Handles substrate network connections,
 * with support for light clients.
 */
export default class Connector {
  readonly #log: Logger;
  readonly #config: ServiceConfiguration;
  readonly #relays: Record<string, ScProvider> = {};
  readonly #chains: Record<string, ProviderInterface> = {};

  #substrateApis?: SubstrateApis;

  constructor(log: Logger, config: ServiceConfiguration) {
    this.#log = log;
    this.#config = config;

    const { networks } = config;

    for (const network of networks) {
      if (this.#chains[network.id] !== undefined) {
        continue;
      }

      log.info('Register network: %s [chainId=%s]', network.name, network.id);

      this.registerNetwork(network);
    }
  }

  private registerNetwork(network: NetworkConfiguration) {
    const { id, name, relay, provider } = network;

    if (provider.type === 'smoldot') {
      if (relay !== undefined) {
        this.#registerSmoldotParachain(id, relay, provider.spec);
      } else {
        this.#registerSmoldotRelay(id, name, provider.spec);
      }
    } else {
      this.#log.info('Register WS provider: %s', id);
      this.#chains[id] = new WsProvider(provider.url, 2_500, undefined, 10_000, 2);
    }
  }

  connect(): SubstrateApis {
    if (this.#substrateApis) {
      return this.#substrateApis;
    }

    this.#log.info('Connect providers');

    const providers: oconfig.Configuration = {};

    for (const key of Object.keys(this.#relays)) {
      const provider = this.#relays[key];
      providers[key] = { provider };
      provider.connect().catch((error) => this.#log.error(error));

      this.#log.info('- Relay %s', key);
    }

    for (const key of Object.keys(this.#chains)) {
      const provider = this.#chains[key];
      providers[key] = { provider };

      this.#log.info('- Chain %s', key);
    }

    // Providers are exposed by chain id.
    this.#substrateApis = new SubstrateApis(providers);
    return this.#substrateApis;
  }

  async disconnect() {
    this.#log.info('Closing connections');

    if (this.#substrateApis) {
      await this.#substrateApis.disconnect();
    }
  }

  #loadSpec(spec: string) {
    return fs.readFileSync(spec, 'utf-8');
  }

  #registerSmoldotRelay(id: string, name: string, spec?: string) {
    this.#log.info('Register relay smoldot provider: %s', id);

    const key = Object.values(Smoldot.WellKnownChain).find((c) => c === name);

    if (key) {
      this.#log.info('Loading well known spec for provider: %s', key);

      this.#relays[id] = new ScProvider(Smoldot, Smoldot.WellKnownChain[key]);
    } else if (spec) {
      this.#relays[id] = new ScProvider(Smoldot, this.#loadSpec(spec));
    } else {
      throw new Error(`Spec not provided for relay chain: ${id}`);
    }
  }

  #getNetworkConfig(name: string) {
    const { networks } = this.#config;
    const conf = networks.find((n) => n.name === name);
    if (conf === undefined) {
      throw new Error(`Configuration for network ${name} not found.`);
    }
    return conf;
  }

  #registerSmoldotParachain(id: string, relay: string, spec?: string) {
    this.#log.info('Register parachain smoldot provider: %s', id);

    if (!spec) {
      throw new Error(`Spec not provided for parachain: ${id}`);
    }

    const { id: relayId, name, provider } = this.#getNetworkConfig(relay);

    // Make sure relay client is registered first
    if (this.#relays[relayId] === undefined) {
      if (provider.type === 'rpc') {
        throw new Error(
          'RPC provider cannot be used for relay chain if light client provider is being used for parachain.'
        );
      }
      this.#registerSmoldotRelay(relayId, name, provider.spec);
    }

    this.#chains[id] = new ScProvider(Smoldot, this.#loadSpec(spec), this.#relays[relayId]);
  }
}
