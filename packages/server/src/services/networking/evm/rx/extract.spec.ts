import { from } from 'rxjs'
import { filter } from 'rxjs/operators'
import { type Abi } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HexString } from '@/lib.js'
import { testEvmBlocksFrom } from '@/testing/blocks.js'
import {
  decodeLogs,
  decodeTransactions,
  filterLogs,
  filterTransactions,
  filterTransactionsWithLogs,
} from './extract.js'

const snowbridgeGatewayAbi: Abi = [
  {
    type: 'event',
    name: 'OutboundMessageAccepted',
    inputs: [
      {
        name: 'channelID',
        type: 'bytes32',
        indexed: true,
        internalType: 'ChannelID',
      },
      {
        name: 'nonce',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'messageID',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'payload',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenSent',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'destinationChain',
        type: 'uint32',
        indexed: true,
        internalType: 'ParaID',
      },
      {
        name: 'destinationAddress',
        type: 'tuple',
        indexed: false,
        internalType: 'struct MultiAddress',
        components: [
          { name: 'kind', type: 'uint8', internalType: 'enum Kind' },
          { name: 'data', type: 'bytes', internalType: 'bytes' },
        ],
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'sendToken',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      {
        name: 'destinationChain',
        type: 'uint32',
        internalType: 'ParaID',
      },
      {
        name: 'destinationAddress',
        type: 'tuple',
        internalType: 'struct MultiAddress',
        components: [
          { name: 'kind', type: 'uint8', internalType: 'enum Kind' },
          { name: 'data', type: 'bytes', internalType: 'bytes' },
        ],
      },
      {
        name: 'destinationFee',
        type: 'uint128',
        internalType: 'uint128',
      },
      { name: 'amount', type: 'uint128', internalType: 'uint128' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
]

const params = [
  {
    abi: snowbridgeGatewayAbi,
    addresses: ['0x27ca963C279c93801941e1eB8799c23f407d68e7'] as HexString[],
  },
]

describe('decode.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('decodeLogs()', () => {
    it('should decode known logs', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor', true))

      const test$ = block$.pipe(
        decodeLogs(params),
        filter(({ eventName }) => eventName !== undefined),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (log) => {
            expect(log).toBeDefined()
            expect(log.eventName).toBeDefined()
            expect(log.args).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })
  })

  describe('filterLogs()', () => {
    it('should filter known logs', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor', true))
      const test$ = block$.pipe(
        filterLogs({ abi: snowbridgeGatewayAbi, addresses: ['0x27ca963C279c93801941e1eB8799c23f407d68e7'] }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (log) => {
            expect(log).toBeDefined()
            expect(log.eventName).toBeDefined()
            expect(log.args).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(2)
            resolve()
          },
        })
      })
    })

    it('should skip known logs on unknown addresses', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor', true))
      const test$ = block$.pipe(
        filterLogs({
          abi: snowbridgeGatewayAbi,
          addresses: ['0x0101963C279c93801941e1eB8799c23f407d680101'],
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (_log) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })

  describe('decodeTransactions()', () => {
    it('should decode known transactions', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor'))

      const test$ = block$.pipe(
        decodeTransactions(params),
        filter(({ decoded }) => decoded !== undefined),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (tx) => {
            expect(tx).toBeDefined()
            expect(tx.decoded).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })
  })

  describe('filterTransactions()', () => {
    it('should filter known transactions', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor'))

      const test$ = block$.pipe(
        filterTransactions({
          abi: snowbridgeGatewayAbi,
          addresses: ['0x27ca963C279c93801941e1eB8799c23f407d68e7'],
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (tx) => {
            expect(tx).toBeDefined()
            expect(tx.decoded).toBeDefined()
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should skip known logs on unknown addresses', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor'))
      const test$ = block$.pipe(
        filterTransactions({
          abi: snowbridgeGatewayAbi,
          addresses: ['0x0101963C279c93801941e1eB8799c23f407d680101'],
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (_tx) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })

  describe('filterTransactionsWithLogs()', () => {
    it('should filter known transactions and logs', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor', true))

      const test$ = block$.pipe(
        filterTransactionsWithLogs(
          {
            abi: snowbridgeGatewayAbi,
            addresses: ['0x27ca963C279c93801941e1eB8799c23f407d68e7'],
          },
          ['sendToken'],
        ),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (tx) => {
            expect(tx).toBeDefined()
            expect(tx.decoded).toBeDefined()
            expect(tx.logs.length).toBe(2)
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(1)
            resolve()
          },
        })
      })
    })

    it('should skip known logs on unknown addresses', async () => {
      const block$ = from(testEvmBlocksFrom('ethereum/23596716.cbor', true))
      const test$ = block$.pipe(
        filterTransactionsWithLogs({
          abi: snowbridgeGatewayAbi,
          addresses: ['0x0101963C279c93801941e1eB8799c23f407d680101'],
        }),
      )
      const calls = vi.fn()

      await new Promise<void>((resolve) => {
        test$.subscribe({
          next: (_tx) => {
            calls()
          },
          complete: () => {
            expect(calls).toHaveBeenCalledTimes(0)
            resolve()
          },
        })
      })
    })
  })
})
