import fs from 'node:fs';

import z from 'zod';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import toml from 'toml';

import { ConfigServerOptions } from '../types.js';

const $RpcProvider = z.object({
  type: z.literal('rpc'),
  url: z.string().min(1),
});

const $SmoldotProvider = z.object({
  type: z.literal('smoldot'),
  spec: z.string().min(1).optional(),
});

const $NetworkProvider = z.discriminatedUnion('type', [$RpcProvider, $SmoldotProvider]);

const networkIdRegex = /^urn:ocn:([a-zA-Z0-9]+):([a-zA-Z0-9]+)$/;

/**
 * The network ID is a URN wit the following format: `urn:ocn:<GlobalConsensus>:<ChainId>`.
 * 
 * - `GlobalConsensus`: A literal representing the consensus network (e.g., Polkadot, Kusama, Ethereum).
 * - `ChainId`: Typically a numeric identifier within the consensus system (e.g., 0 for Polkadot relay chain, a parachain id).
 */
export const $NetworkId = z.string().regex(networkIdRegex);

const $NetworkConfiguration = z.object({
  name: z
    .string({
      required_error: 'Network name is required',
    })
    .min(1),
  id: $NetworkId,
  relay: z.string().min(1).optional(),
  provider: $NetworkProvider,
  recovery: z.boolean().optional(),
  batchSize: z.number().int().min(1).optional(),
});

export const $ServiceConfiguration = z.object({
  networks: z.array($NetworkConfiguration).min(1),
});

export type NetworkId = z.infer<typeof $NetworkId>;
export type NetworkConfiguration = z.infer<typeof $NetworkConfiguration>;
export type ServiceConfiguration = z.infer<typeof $ServiceConfiguration>;

export function isRelay({ networks }: ServiceConfiguration, chainId: string) {
  return networks.findIndex((n) => n.relay === undefined && n.id === chainId) >= 0;
}

export function isNetworkDefined({ networks }: ServiceConfiguration, chainId: string) {
  return networks.findIndex((n) => n.id === chainId) >= 0;
}

declare module 'fastify' {
  interface FastifyInstance {
    localConfig: ServiceConfiguration;
  }
}

const configPlugin: FastifyPluginAsync<ConfigServerOptions> = async (fastify, options) => {
  if (options.config === undefined) {
    throw new Error('Service configuration file was not provided');
  }

  const configPath = options.config;

  fastify.log.info(`Loading configuration from ${configPath}`);

  try {
    const config = $ServiceConfiguration.parse(toml.parse(fs.readFileSync(configPath, 'utf-8')));
    fastify.decorate('localConfig', config);
  } catch (err) {
    /* istanbul ignore next */
    if (err instanceof z.ZodError) {
      fastify.log.error(err.issues);
    } else {
      fastify.log.error(err);
    }
    /* istanbul ignore next */
    throw new Error('Error while loading configuration.');
  }
};

export default fp(configPlugin, { fastify: '>=4.x', name: 'config' });
