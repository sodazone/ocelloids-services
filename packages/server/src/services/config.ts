import fs from 'node:fs'

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import toml from 'toml'
import z from 'zod'

import { ConfigServerOptions } from '../types.js'
import { NetworkURN } from './types.js'

const $RpcProvider = z.object({
  type: z.literal('rpc'),
  url: z.string().min(1),
})

const wellKnownChains = ['polkadot', 'ksmcc3', 'rococo_v2_2', 'westend2'] as const

const $SmoldotProvider = z.object({
  type: z.literal('smoldot'),
  name: z.enum(wellKnownChains).optional(),
  spec: z.string().min(1).optional(),
})

const globalConsensus = [
  'local',
  'polkadot',
  'kusama',
  'rococo',
  'wococo',
  'westend',
  'ethereum',
  'byfork',
  'bygenesis',
  'bitcoincore',
  'bitcoincash',
] as const

export type GlobalConsensus = (typeof globalConsensus)[number]

const $NetworkProvider = z.discriminatedUnion('type', [$RpcProvider, $SmoldotProvider])

const networkIdRegex = new RegExp(`^urn:ocn:(${globalConsensus.join('|')}):([a-zA-Z0-9]+)$`)

/**
 * The network ID is a URN with the following format: `urn:ocn:<GlobalConsensus>:<ChainId>`.
 *
 * - `GlobalConsensus`: A literal representing the consensus network (e.g., polkadot, kusama, ethereum).
 * - `ChainId`: Typically a numeric identifier within the consensus system (e.g., 0 for Polkadot relay chain, a parachain id).
 */
export const $NetworkId = z.string().regex(networkIdRegex)

const $NetworkConfiguration = z.object({
  id: $NetworkId,
  relay: $NetworkId.optional(),
  provider: $NetworkProvider,
  recovery: z.boolean().optional(),
  batchSize: z.number().int().min(1).optional(),
})

export const $ServiceConfiguration = z.object({
  networks: z.array($NetworkConfiguration).min(1),
})

export type NetworkId = z.infer<typeof $NetworkId>
export type NetworkConfiguration = z.infer<typeof $NetworkConfiguration>
export type ServiceConfiguration = z.infer<typeof $ServiceConfiguration>

export function isRelay({ networks }: ServiceConfiguration, chainId: NetworkURN) {
  return networks.findIndex((n) => n.relay === undefined && n.id === chainId) >= 0
}

export function isNetworkDefined({ networks }: ServiceConfiguration, chainId: NetworkURN) {
  return networks.findIndex((n) => n.id === chainId) >= 0
}

export function getConsensus(networkId: NetworkURN) {
  return networkId.split(':')[2]
}

export function getChainId(networkId: NetworkURN) {
  return networkId.split(':')[3]
}

export function getRelayId(networkId: NetworkURN): NetworkURN {
  return `urn:ocn:${getConsensus(networkId)}:0`
}

export function createNetworkId(consensus: string | NetworkURN, chainId: string): NetworkURN {
  const c = consensus.startsWith('urn:ocn:') ? getConsensus(consensus as NetworkURN) : consensus
  return `urn:ocn:${c}:${chainId}`
}

declare module 'fastify' {
  interface FastifyInstance {
    localConfig: ServiceConfiguration
  }
}

const configPlugin: FastifyPluginAsync<ConfigServerOptions> = async (fastify, options) => {
  if (options.config === undefined) {
    throw new Error('Service configuration file was not provided')
  }

  const configPath = options.config

  fastify.log.info(`Loading configuration from ${configPath}`)

  try {
    const config = $ServiceConfiguration.parse(toml.parse(fs.readFileSync(configPath, 'utf-8')))
    fastify.decorate('localConfig', config)
  } catch (err) {
    /* istanbul ignore next */
    if (err instanceof z.ZodError) {
      fastify.log.error(err.issues)
    } else {
      fastify.log.error(err)
    }
    /* istanbul ignore next */
    throw new Error('Error while loading configuration.')
  }
}

export default fp(configPlugin, { fastify: '>=4.x', name: 'config' })
