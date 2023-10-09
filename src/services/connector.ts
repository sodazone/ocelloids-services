
import fs from 'node:fs';

import { ProviderInterface } from '@polkadot/rpc-provider/types';
import { WsProvider, ScProvider } from '@polkadot/api';
import * as Sc from '@substrate/connect';
import { config as oconfig, SubstrateApis } from '@sodazone/ocelloids';

import { NetworkConfiguration } from './configuration.js';
import { ServiceContext } from './context.js';

/**
 *
 */
export default class Connector {
  #relays: Record<string, ScProvider> = {};
  #chains: Record<string, ProviderInterface> = {};
  #chainIdMap: Record<string, number> = {};
  #substrateApis?: SubstrateApis;
  #ctx: ServiceContext;

  constructor(ctx: ServiceContext) {
    this.#ctx = ctx;

    const { config: { networks } } = ctx;

    for (const network of networks) {
      if (this.#chains[network.name] !== undefined) {
        continue;
      }

      ctx.log.info(`Register network: ${network.name} [chainId=${network.id}]`);

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
      this.#ctx.log.info(`Register WS provider: ${name}`);
      this.#chains[name] = new WsProvider(provider.url);
    }
  }

  connect() {
    if (this.#substrateApis) {
      return this.#substrateApis;
    }

    const providers: oconfig.Configuration = {};

    for (const key of Object.keys(this.#relays)) {
      const provider = this.#relays[key];
      providers[this.#chainIdMap[key]] = {provider};
      provider.connect().catch(
        this.#ctx.log.error.bind(this.#ctx.log)
      );
    }

    for (const key of Object.keys(this.#chains)) {
      const provider = this.#chains[key];
      providers[this.#chainIdMap[key]] = {provider};
      if (provider instanceof ScProvider) {
        provider.connect().catch(
          this.#ctx.log.error.bind(this.#ctx.log)
        );
      }
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

  #registerSmoldotRelay(name: string, spec: string) {
    this.#ctx.log.info(`Register relay smoldot provider: ${name}`);
    const key = Object.values(Sc.WellKnownChain).find(
      c => c === name
    );

    if (key) {
      this.#relays[name] = new ScProvider(
        Sc, Sc.WellKnownChain[key]
      );
    } else {
      this.#relays[name] = new ScProvider(Sc,
        this.#loadSpec(spec)
      );
    }
  }

  #getNetworkConfig(name: string) {
    const conf =  this.#ctx.config.networks.find(n => n.name === name);
    if (conf === undefined) {
      throw new Error(`Configuration for network ${name} not found.`);
    }
    return conf;
  }

  #registerSmoldotParachain(name: string, relay: string, spec: string) {
    this.#ctx.log.info(`Register parachain smoldot provider: ${name}`);
    // Make sure relay client is registered first
    if (this.#relays[relay] === undefined) {
      const relayConfig = this.#getNetworkConfig(relay);
      if (relayConfig.provider.type === 'rpc') {
        throw new Error('RPC provider cannot be used for relay chain if light client provider is being used for parachain.');
      }
      this.#registerSmoldotRelay(relayConfig.name, relayConfig.provider.spec);
    }

    this.#chains[name] = new ScProvider(Sc,
      this.#loadSpec(spec),
      this.#relays[relay]
    );
  }
}