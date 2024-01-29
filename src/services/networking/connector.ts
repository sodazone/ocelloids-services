
import fs from 'node:fs';

import { ProviderInterface } from '@polkadot/rpc-provider/types';
import { WsProvider, ScProvider } from '@polkadot/api';
import { config as oconfig, SubstrateApis, Smoldot } from '@sodazone/ocelloids';

import { NetworkConfiguration, ServiceConfiguration } from '../config.js';
import { Logger } from '../types.js';

/**
 * Handles substrate network connections,
 * with support for light clients.
 */
export default class Connector {
  #log: Logger;
  #config: ServiceConfiguration;
  #relays: Record<string, ScProvider> = {};
  #chains: Record<string, ProviderInterface> = {};
  #chainIdMap: Record<string, number> = {};

  #substrateApis?: SubstrateApis;

  constructor(
    log: Logger,
    config: ServiceConfiguration
  ) {
    this.#log = log;
    this.#config = config;

    const { networks } = config;

    for (const network of networks) {
      if (this.#chains[network.name] !== undefined) {
        continue;
      }

      log.info(`Register network: ${network.name} [chainId=${network.id}]`);

      this.#chainIdMap[network.name] = network.id;
      this.registerNetwork(network);
    }
  }

  private registerNetwork(network: NetworkConfiguration) {
    const { name, relay, provider } = network;

    if (provider.type === 'smoldot') {
      if (relay !== undefined) {
        this.#registerSmoldotParachain(name, relay, provider.spec);
      } else {
        this.#registerSmoldotRelay(name, provider.spec);
      }
    } else {
      this.#log.info(`Register WS provider: ${name}`);
      this.#chains[name] = new WsProvider(provider.url);
    }
  }

  connect() {
    if (this.#substrateApis) {
      return this.#substrateApis;
    }

    this.#log.info('Connect providers');

    const providers: oconfig.Configuration = {};

    for (const key of Object.keys(this.#relays)) {
      const provider = this.#relays[key];
      providers[this.#chainIdMap[key]] = {provider};
      provider.connect().catch(
        this.#log.error.bind(this.#log)
      );
    }

    for (const key of Object.keys(this.#chains)) {
      const provider = this.#chains[key];
      providers[this.#chainIdMap[key]] = {provider};
    }

    // Providers are exposed by chain id.
    this.#substrateApis = new SubstrateApis(providers);
    return this.#substrateApis;
  }

  async disconnect() {
    if (this.#substrateApis) {
      await this.#substrateApis.disconnect();
    }
  }

  #loadSpec(spec: string) {
    return fs.readFileSync(spec, 'utf-8');
  }

  #registerSmoldotRelay(name: string, spec?: string) {
    this.#log.info(`Register relay smoldot provider: ${name}`);

    const key = Object.values(Smoldot.WellKnownChain).find(
      c => c === name
    );

    if (key) {
      this.#log.info('Loading well known spec for provider: %s', key);

      this.#relays[name] = new ScProvider(
        Smoldot, Smoldot.WellKnownChain[key]
      );
    } else if (spec) {
      this.#relays[name] = new ScProvider(Smoldot,
        this.#loadSpec(spec)
      );
    } else {
      throw new Error(`Spec not provided for relay chain: ${name}`);
    }
  }

  #getNetworkConfig(name: string) {
    const { networks } = this.#config;
    const conf =  networks.find(n => n.name === name);
    if (conf === undefined) {
      throw new Error(`Configuration for network ${name} not found.`);
    }
    return conf;
  }

  #registerSmoldotParachain(name: string, relay: string, spec?: string) {
    this.#log.info(`Register parachain smoldot provider: ${name}`);

    if (!spec) {
      throw new Error(`Spec not provided for parachain: ${name}`);
    }

    // Make sure relay client is registered first
    if (this.#relays[relay] === undefined) {
      const relayConfig = this.#getNetworkConfig(relay);
      if (relayConfig.provider.type === 'rpc') {
        throw new Error('RPC provider cannot be used for relay chain if light client provider is being used for parachain.');
      }
      this.#registerSmoldotRelay(relayConfig.name, relayConfig.provider.spec);
    }

    this.#chains[name] = new ScProvider(Smoldot,
      this.#loadSpec(spec),
      this.#relays[relay]
    );
  }
}