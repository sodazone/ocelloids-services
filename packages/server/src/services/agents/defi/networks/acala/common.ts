import { networks } from '@/services/agents/common/networks.js'

export const CHAIN_ID = networks.acala

export const TARGET_PRECISION = 18
export const PRECISION_BIGINT = 10n ** BigInt(TARGET_PRECISION)

export const DOT_DECIMALS = 10
export const DOT_SYMBOL = 'DOT'

export const LDOT_DECIMALS = 10
export const LDOT_SYMBOL = 'LDOT'
