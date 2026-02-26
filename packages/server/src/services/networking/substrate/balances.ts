import { Binary } from 'polkadot-api'
import { AnyJson } from '@/services/types.js'

export type Balance = {
  free: bigint
  reserved: bigint
  frozen: bigint
}

export type AssetsBalance = {
  balance: bigint
  status: AnyJson
  reason: AnyJson
  extra: AnyJson
}

export type NativeBalance = {
  nonce: number
  consumers: number
  providers: number
  sufficients: number
  data: Balance
}

const balanceExtractorMappers: Record<string, (value: any) => bigint> = {
  'assets.account': (value: AssetsBalance) => {
    return value.balance
  },
  'currenciesapi.account': (value: Balance) => {
    return calculateFreeBalance(value)
  },
  'ethereumruntimerpcapi.call': (value: any) => {
    if (typeof value === 'bigint') {
      return value
    } else if (typeof value === 'object' && value.success && 'value' in value) {
      try {
        const v = value.value.value as Binary
        const h = v.asHex()
        return BigInt(h === '0x' ? 0 : h)
      } catch (err) {
        console.warn(err, 'Balance extractor error in ethereumruntimerpcapi.call')
      }
    }
    return 0n
  },
  'evm.accountstorages': (value: Binary) => {
    return BigInt(value.asHex())
  },
  'foreignassets.account': (value: AssetsBalance) => {
    return value.balance
  },
  'system.account': ({ data }: NativeBalance) => {
    return calculateFreeBalance(data)
  },
  'tokens.accounts': (value: Balance) => {
    return calculateFreeBalance(value)
  },
}

export function getBalanceExtractor(...path: string[]) {
  return balanceExtractorMappers[path.map((p) => p.toLowerCase()).join('.')]
}

export function calculateFreeBalance(data: Balance): bigint {
  const { free, frozen } = data

  if (free < frozen) {
    return 0n
  }

  return free - frozen
}
