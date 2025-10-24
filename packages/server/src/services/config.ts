import fs from 'node:fs'

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import toml from 'toml'
import z from 'zod'

import { NetworkURN } from '@/services/types.js'
import { ConfigServerOptions } from '@/types.js'

const $RpcProvider = z.object({
  type: z.literal('rpc'),
  url: z
    .string()
    .min(1)
    .or(z.array(z.string().min(1)).min(1)),
})

const globalConsensus = [
  'local',
  'polkadot',
  'kusama',
  'rococo',
  'wococo',
  'paseo',
  'chainflip',
  'alephzero',
  'polymesh',
  'ternoa',
  'avail',
  'westend',
  'ethereum',
  'byfork',
  'bygenesis',
  'bitcoincore',
  'bitcoincash',
] as const

export type GlobalConsensus = (typeof globalConsensus)[number]

export function isGlobalConsensus(value: string): value is GlobalConsensus {
  const s: readonly string[] = globalConsensus
  return s.includes(value)
}

const $NetworkProvider = $RpcProvider

const networkIdRegex = new RegExp(`^urn:ocn:(${globalConsensus.join('|')}):([a-zA-Z0-9]+)$`)

export const $ClientId = z.enum(['substrate', 'bitcoin', 'evm'])

/**
 * The network ID is a URN with the following format: `urn:ocn:<GlobalConsensus>:<ChainId>`.
 *
 * - `GlobalConsensus`: A literal representing the consensus network (e.g., polkadot, kusama, ethereum).
 * - `ChainId`: Typically a numeric ID within the consensus system (e.g., 0 for Polkadot relay chain, a parachain id).
 */
export const $NetworkId = z.string().regex(networkIdRegex)

const $NetworkConfiguration = z.object({
  id: $NetworkId,
  provider: $NetworkProvider,
  recovery: z.boolean().optional(),
  batchSize: z.number().int().min(1).optional(),
})

const $SubstrateNetworkConfiguration = $NetworkConfiguration.extend({
  relay: $NetworkId.optional(),
})

export const $ServiceConfiguration = z.object({
  substrate: z
    .object({
      networks: z.array($SubstrateNetworkConfiguration).min(1),
    })
    .optional(),
  bitcoin: z
    .object({
      networks: z.array($NetworkConfiguration).min(1),
    })
    .optional(),
  evm: z
    .object({
      networks: z.array($NetworkConfiguration).min(1),
    })
    .optional(),
})

type SubstrateNetworkConfiguration = z.infer<typeof $SubstrateNetworkConfiguration>
export type NetworkId = z.infer<typeof $NetworkId>
export type NetworkConfiguration = z.infer<typeof $NetworkConfiguration>
export const clientIds = ['substrate', 'bitcoin', 'evm'] as const
export type ClientId = (typeof clientIds)[number]

export class ServiceConfiguration {
  readonly all
  readonly networks: Record<ClientId, NetworkConfiguration[]>

  constructor(config: z.infer<typeof $ServiceConfiguration>) {
    const substrate = config.substrate?.networks ?? []
    const bitcoin = config.bitcoin?.networks ?? []
    const evm = config.evm?.networks ?? []
    this.networks = {
      substrate,
      bitcoin,
      evm,
    }
    this.all = substrate.concat(bitcoin).concat(evm)
  }

  get substrate() {
    return this.networks.substrate as SubstrateNetworkConfiguration[]
  }

  get bitcoin() {
    return this.networks.bitcoin as NetworkConfiguration[]
  }

  get evm() {
    return this.networks.evm as NetworkConfiguration[]
  }

  getNetwork(chainId: NetworkURN) {
    return this.all.find((n) => n.id === chainId)
  }

  isRelay(chainId: NetworkURN) {
    return (
      this.substrate.findIndex(
        (n) => (n as SubstrateNetworkConfiguration).relay === undefined && n.id === chainId,
      ) >= 0
    )
  }

  isNetworkDefined(chainId: NetworkURN) {
    return this.all.findIndex((n) => n.id === chainId) >= 0
  }
}

export function getConsensus(networkId: NetworkURN) {
  return networkId.split(':')[2]
}

export function isOnSameConsensus(network1: NetworkURN, network2: NetworkURN) {
  return getConsensus(network1) === getConsensus(network2)
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
    const localConfig = new ServiceConfiguration(config)

    fastify.decorate('localConfig', localConfig)
  } catch (err) {
    /* c8 ignore next */
    if (err instanceof z.ZodError) {
      fastify.log.error(err.issues)
    } else {
      fastify.log.error(err)
    }
    /* c8 ignore next */
    throw new Error('Error while loading configuration.')
  }
}

export default fp(configPlugin, { fastify: '>=4.x', name: 'config' })
