import { HexString, NetworkURN } from '@/lib.js'

export const HYPERBRIDGE_CONFIG: {
  networks: {
    substrate: NetworkURN[]
    evm: NetworkURN[]
  }
} = {
  networks: {
    substrate: ['urn:ocn:polkadot:2030'],
    evm: ['urn:ocn:ethereum:10', 'urn:ocn:ethereum:56', 'urn:ocn:ethereum:8453', 'urn:ocn:ethreum:42161'],
  },
}

const TOKEN_GATEWAYS = [
  '0xfd413e3afe560182c4471f4d143a96d3e259b6de',
  '0xce304770236f39f9911bfcc51afbdf3b8635718', // Soneium
  '0x8b536105b6fae2ae9199f5146d3c57dfe53b614e', // Polygon + Unichain
]

export function isTokenGateway(contract: HexString) {
  return TOKEN_GATEWAYS.includes(contract)
}
