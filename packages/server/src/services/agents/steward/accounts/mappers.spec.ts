import { getStablePoolAddress, mergeAccountMetadata } from './mappers.js'
import { SubstrateAccountMetadata, SubstrateAccountUpdate } from './types.js'

describe('mappers', () => {
  describe('getStablePoolAddress', () => {
    it('should return stableswap pool public key and evm address', () => {
      const poolIdHex = '0xb2020000'
      const bytes = Buffer.from(poolIdHex.slice(2), 'hex')
      const poolId = bytes.readUInt32LE(0)
      const [substrateKey, evmAddress] = getStablePoolAddress(poolId)
      expect(substrateKey).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739c2843fb0cf096283a7d9c261')
      expect(evmAddress).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739')
    })
  })

  describe('mergeAccountMetadata', () => {
    const PUBLIC_KEY = '0xabc123'

    const basePersisted: SubstrateAccountMetadata = {
      publicKey: PUBLIC_KEY,
      evm: [],
      identities: [],
      categories: [],
      tags: [],
      updatedAt: 1000,
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(2000)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('creates new metadata when persisted is undefined', () => {
      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        evm: [{ address: '0x1', chainId: 'urn:ocn:test:1' }],
      }

      const result = mergeAccountMetadata(undefined, incoming)

      expect(result.publicKey).toBe(PUBLIC_KEY)
      expect(result.evm).toHaveLength(1)
      expect(result.identities).toEqual([])
      expect(result.categories).toEqual([])
      expect(result.tags).toEqual([])
      expect(result.updatedAt).toBe(2000)
    })

    it('returns persisted when nothing changes', () => {
      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
      }

      const result = mergeAccountMetadata(basePersisted, incoming)

      expect(result).toBe(basePersisted)
    })

    it('merges new evm entries', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        evm: [{ address: '0x01', chainId: 'urn:ocn:test:1' }],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        evm: [{ address: '0x02', chainId: 'urn:ocn:test:1' }],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result.evm).toHaveLength(2)
      expect(result.updatedAt).toBe(2000)
    })

    it('does not duplicate identical evm entries', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        evm: [{ address: '0x1', chainId: 'urn:ocn:test:1' }],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        evm: [{ address: '0x1', chainId: 'urn:ocn:test:1' }],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result).toBe(persisted)
    })

    it('merges identities when different', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        identities: [
          {
            chainId: 'urn:ocn:test:1',
            display: 'Alice',
            judgements: [],
            extra: {},
          },
        ],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        identities: [
          {
            chainId: 'urn:ocn:test:1',
            display: 'Alice Updated',
            judgements: [],
            extra: {},
          },
        ],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result.identities[0].display).toBe('Alice Updated')
      expect(result.updatedAt).toBe(2000)
    })

    it('merges categories correctly', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        categories: [
          {
            chainId: 'urn:ocn:test:1',
            categoryCode: 1,
            subCategoryCode: 1,
          },
        ],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        categories: [
          {
            chainId: 'urn:ocn:test:1',
            categoryCode: 1,
            subCategoryCode: 2,
          },
        ],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result.categories).toHaveLength(2)
      expect(result.updatedAt).toBe(2000)
    })

    it('does not duplicate identical categories', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        categories: [
          {
            chainId: 'urn:ocn:test:1',
            categoryCode: 1,
            subCategoryCode: 1,
          },
        ],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        categories: [
          {
            chainId: 'urn:ocn:test:1',
            categoryCode: 1,
            subCategoryCode: 1,
          },
        ],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result).toBe(persisted)
    })

    it('merges tags correctly', () => {
      const persisted: SubstrateAccountMetadata = {
        ...basePersisted,
        tags: [{ chainId: 'urn:ocn:test:1', tag: 'vip' }],
      }

      const incoming: SubstrateAccountUpdate = {
        publicKey: PUBLIC_KEY,
        tags: [{ chainId: 'urn:ocn:test:1', tag: 'new' }],
      }

      const result = mergeAccountMetadata(persisted, incoming)

      expect(result.tags).toHaveLength(2)
      expect(result.updatedAt).toBe(2000)
    })
  })
})
