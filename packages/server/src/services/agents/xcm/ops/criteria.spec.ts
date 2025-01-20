import { ControlQuery } from '@/common/index.js'
import { matchMessages } from '@/testing/matching.js'
import { matchMessage, matchSenders, messageCriteria, sendersCriteria } from './criteria.js'

describe('control query criteria', () => {
  const testSendersQuery = new ControlQuery(
    sendersCriteria(['15tmnFTCArWaxNqxMaK4ey77RoL6c282ho5NnfQuFzgmwLKn']),
  )
  const testMessageQuery = new ControlQuery(messageCriteria(['urn:ocn:local:0', 'urn:ocn:local:2000']))
  const { origin: xcmSent } = matchMessages

  describe('matchSenders', () => {
    it('should return true if sender matches query', () => {
      const matched = matchSenders(testSendersQuery, {
        signer: {
          id: '15tmnFTCArWaxNqxMaK4ey77RoL6c282ho5NnfQuFzgmwLKn',
          publicKey: '0xd86d3160d360897d4576e08153bd0a80a5dee1812702c9bfd268c11a83737269',
        },
        extraSigners: [],
      })

      expect(matched).toBe(true)
    })

    it('should return true if sender matches query by public key', () => {
      const matched = matchSenders(
        new ControlQuery(
          sendersCriteria(['0xd86d3160d360897d4576e08153bd0a80a5dee1812702c9bfd268c11a83737269']),
        ),
        {
          signer: {
            id: '15tmnFTCArWaxNqxMaK4ey77RoL6c282ho5NnfQuFzgmwLKn',
            publicKey: '0xd86d3160d360897d4576e08153bd0a80a5dee1812702c9bfd268c11a83737269',
          },
          extraSigners: [],
        },
      )

      expect(matched).toBe(true)
    })

    it('should return true if sender matches query with different SS58 prefix by public key', () => {
      const matched = matchSenders(
        new ControlQuery(sendersCriteria(['25mNNAsE1mFrWxtbQu7JRymMtem39rREbCcgwVqutYdekLBH'])),
        {
          signer: {
            id: '15tmnFTCArWaxNqxMaK4ey77RoL6c282ho5NnfQuFzgmwLKn',
            publicKey: '0xd86d3160d360897d4576e08153bd0a80a5dee1812702c9bfd268c11a83737269',
          },
          extraSigners: [],
        },
      )

      expect(matched).toBe(true)
    })

    it('should return true if extra signers matches query', () => {
      const matched = matchSenders(testSendersQuery, {
        signer: {
          id: '14RaDYACUL5SN879NWik5JGtWhoeMT8hmPTpCEnv4ZNNvnB9',
          publicKey: '0x977267d6d5a6e2ef0b5afcfa1ee22aefad1888493c9661e1f8bfb3b9a9a6faee',
        },
        extraSigners: [
          {
            type: 'proxy',
            id: '15tmnFTCArWaxNqxMaK4ey77RoL6c282ho5NnfQuFzgmwLKn',
            publicKey: '0xd86d3160d360897d4576e08153bd0a80a5dee1812702c9bfd268c11a83737269',
          },
        ],
      })

      expect(matched).toBe(true)
    })

    it('should return false if sender is undefined', () => {
      const matched = matchSenders(testSendersQuery, undefined)

      expect(matched).toBe(false)
    })
  })

  describe('matchMessage', () => {
    it('should return true if destination is in query', () => {
      const matched = matchMessage(testMessageQuery, xcmSent.destination)

      expect(matched).toBe(true)
    })

    it('should return false if destination is not in query', () => {
      const matched = matchMessage(testMessageQuery, { chainId: 'urn:ocn:local:3000' })

      expect(matched).toBe(false)
    })
  })
})
