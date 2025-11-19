import { toHex } from 'polkadot-api/utils'
import { keccak256, sliceHex, stringToBytes } from 'viem'
import { HexString, NetworkURN } from '@/lib.js'
import { FormattedAddress } from './types.js'

const setNetworks = <T extends Record<string, NetworkURN>>(network: T) => network

export const networks = setNetworks({
  bifrost: 'urn:ocn:polkadot:2030',
  hyperbridge: 'urn:ocn:polkadot:3367',
  ethereum: 'urn:ocn:ethereum:1',
  arbitrum: 'urn:ocn:ethereum:42161',
  optimism: 'urn:ocn:ethereum:10',
  base: 'urn:ocn:ethereum:8453',
  bsc: 'urn:ocn:ethereum:56',
  gnosis: 'urn:ocn:ethereum:100',
  soneium: 'urn:ocn:ethereum:1868',
  polygon: 'urn:ocn:ethereum:137',
  unichain: 'urn:ocn:ethereum:130',
})

export const HYPERBRIDGE_CONFIG: {
  networks: {
    substrate: NetworkURN[]
    evm: NetworkURN[]
  }
} = {
  networks: {
    substrate: [networks.bifrost, networks.hyperbridge],
    evm: [networks.ethereum, networks.optimism, networks.bsc, networks.base, networks.arbitrum],
  },
}

export const HYPERBRIDGE_NETWORK_ID = 'urn:ocn:polkadot:3367'

const ETHEREUM_HOSTS: Record<NetworkURN, HexString> = {
  'urn:ocn:ethereum:1': '0x792a6236af69787c40cf76b69b4c8c7b28c4ca20', // Ethereum
  'urn:ocn:ethereum:42161': '0xe05afd4eb2ce6d65c40e1048381bd0ef8b4b299e', // Arbitrum
  'urn:ocn:ethereum:10': '0x78c8a5f27c06757ea0e30bea682f1fd5c8d7645d', // Optimism
  'urn:ocn:ethereum:8453': '0x6ffe92e4d7a9d589549644544780e6725e84b248', // Base
  'urn:ocn:ethereum:56': '0x24b5d421ec373fca57325dd2f0c074009af021f7', // BSC
  'urn:ocn:ethereum:100': '0x50c236247447b9d4ee0561054ee596fbda7791b1', // Gnosis
  'urn:ocn:ethereum:1868': '0x7f0165140d0f3251c8f6465e94e9d12c7fd40711', // Soneium
  'urn:ocn:ethereum:137': '0xd8d3db17c1df65b301d45c84405ccac1395c559a', // Polygon
  'urn:ocn:ethereum:130': '0x2a17c1c3616bbc33fce5af5b965f166ba76cedaf', // Unichain
}

const ETHEREUM_HANDLERS: Record<NetworkURN, HexString> = {
  'urn:ocn:ethereum:1': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Ethereum
  'urn:ocn:ethereum:42161': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Arbitrum
  'urn:ocn:ethereum:10': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Optimism
  'urn:ocn:ethereum:8453': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Base
  'urn:ocn:ethereum:56': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // BSC
  'urn:ocn:ethereum:100': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Gnosis
  'urn:ocn:ethereum:1868': '0x6c84edd2a018b1fe2fc93a56066b5c60da4e6d64', // Soneium
  'urn:ocn:ethereum:137': '0x61f56ee7d15f4a11ba7ee9f233c136563cb5ad37', // Polygon
  'urn:ocn:ethereum:130': '0x85f82d70ceed45ca0d1b154c297946babcf4d344', // Unichain
}

export const TOKEN_GATEWAYS: Record<NetworkURN, HexString> = {
  'urn:ocn:ethereum:1': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // Ethereum
  'urn:ocn:ethereum:42161': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // Arbitrum
  'urn:ocn:ethereum:10': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // Optimism
  'urn:ocn:ethereum:8453': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // Base
  'urn:ocn:ethereum:56': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // BSC
  'urn:ocn:ethereum:100': '0xfd413e3afe560182c4471f4d143a96d3e259b6de', // Gnosis
  'urn:ocn:ethereum:1868': '0xce304770236f39f9911bfcc51afbdf3b8635718', // Soneium
  'urn:ocn:ethereum:137': '0x8b536105b6fae2ae9199f5146d3c57dfe53b614e', // Polygon
  'urn:ocn:ethereum:130': '0x8b536105b6fae2ae9199f5146d3c57dfe53b614e', // Unichain
}

const BIFROST_ORACLES = [
  '0x5b631863df1b20afb2715ee1f1381d6dc1dd065d', // ETH/BSC/OP
  '0x0a702f34da7b4514c74d35ff68891d1ee57930ef', // Soneium
]

const MODULE_IDS = {
  TOKEN_GATEWAY: (() => sliceHex(keccak256(stringToBytes('tokengty')), 12))(),
  BIFROST: toHex(stringToBytes('ismp-bnc')),
  SLPX: toHex(stringToBytes('bif-slpx')),
  HYPERBRIDGE: toHex(stringToBytes('HYPR-FEE')),
}

export function getHostContractAddress(chainId: NetworkURN): HexString | null {
  const contract = ETHEREUM_HOSTS[chainId]
  if (!contract) {
    console.error(`Host contract address not found for ${chainId}`)
    return null
  }
  return contract
}

export function getHandlerContractAddress(chainId: NetworkURN): HexString | null {
  const contract = ETHEREUM_HANDLERS[chainId]
  if (!contract) {
    console.error(`Handler contract address not found for ${chainId}`)
    return null
  }
  return contract
}

export function toIsmpModule(to: HexString) {
  switch (to.toLowerCase()) {
    case MODULE_IDS.TOKEN_GATEWAY.toLowerCase():
      return 'token-gateway'
    case MODULE_IDS.BIFROST.toLowerCase():
      return 'bifrost'
    case MODULE_IDS.SLPX.toLowerCase():
      return 'bifrost-slpx'
    case MODULE_IDS.HYPERBRIDGE.toLowerCase():
      return 'hyperbridge'
    default:
      return 'unknown'
  }
}

export function isTokenGateway({ key, formatted }: FormattedAddress) {
  return Object.values(TOKEN_GATEWAYS).includes(key) || formatted === 'token-gateway'
}

export function isBifrostOracle({ key }: FormattedAddress) {
  return BIFROST_ORACLES.includes(key)
}
