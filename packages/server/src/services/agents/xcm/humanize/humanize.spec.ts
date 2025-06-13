import { createServices } from '@/testing/services.js'
import { apiContext } from '@/testing/xcm.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { fromXcmpFormat } from '../ops/xcm-format.js'
import { XcmHumanizer } from './index.js'

describe('XcmHumanizer', () => {
  let humanizer: XcmHumanizer

  beforeEach(() => {
    const services = createServices()
    humanizer = new XcmHumanizer({
      log: services.log,
      ingress: services.ingress.substrate,
      deps: {
        steward: services.agentCatalog.getAgentById('steward'),
        ticker: services.agentCatalog.getAgentById('ticker'),
      },
    })
  })

  it('should parse assets in bridgehub to hydration message', async () => {
    const v5Msg =
      '00052402040100000327d33b511301000002286bee000b010450250907040104020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae90013000010433510e9fa0a16040d01020802010907040e010208010100c91f0c130100009e248456000d010208000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc481292cd8fae184551d7ea5884f39827c59d3f844a8273037ce674e9cac926e4dc48129'
    const buf = new Uint8Array(Buffer.from(v5Msg, 'hex'))
    const instructions = fromXcmpFormat(buf, apiContext)[0].instructions

    const results = await humanizer.humanize({
      type: 'xcm.received',
      legs: [
        {
          from: 'urn:ocn:polkadot:1002',
          to: 'urn:ocn:polkadot:1000',
          type: 'hop',
          relay: 'urn:ocn:polkadot:0',
        },
        {
          from: 'urn:ocn:polkadot:1000',
          to: 'urn:ocn:polkadot:2034',
          type: 'hrmp',
          relay: 'urn:ocn:polkadot:0',
        },
      ],
      origin: {
        chainId: 'urn:ocn:polkadot:1002',
        blockHash: '0x01',
        blockNumber: 33,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions,
      },
      waypoint: {
        chainId: 'urn:ocn:polkadot:2034',
        blockHash: '0x02',
        blockNumber: 1,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions: {
          type: 'V5',
          value: instructions,
        },
        legIndex: 1,
      },
      destination: {
        chainId: 'urn:ocn:polkadot:2034',
        blockHash: '0x02',
        blockNumber: 1,
      },
    })
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transfer')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.to.formatted).toBeDefined()
    expect(results.humanized.version).toBe('V5')
  })

  it('should parse assets in assethub to bridgehub message', async () => {
    const instructions = [
      {
        type: 'WithdrawAsset',
        value: [
          {
            id: { type: 'Concrete', value: { parents: 1, interior: { type: 'Here' } } },
            fun: { type: 'Fungible', value: '14929540998' },
          },
        ],
      },
      {
        type: 'BuyExecution',
        value: {
          fees: {
            id: { type: 'Concrete', value: { parents: 1, interior: { type: 'Here' } } },
            fun: { type: 'Fungible', value: '14929540998' },
          },
          weight_limit: { type: 'Unlimited' },
        },
      },
      {
        type: 'SetAppendix',
        value: [
          {
            type: 'DepositAsset',
            value: {
              assets: { type: 'Wild', value: { type: 'AllCounted', value: 1 } },
              beneficiary: {
                parents: 1,
                interior: { type: 'X1', value: { type: 'Parachain', value: 1000 } },
              },
            },
          },
        ],
      },
      {
        type: 'ExportMessage',
        value: {
          network: { type: 'Ethereum', value: { chain_id: '1' } },
          destination: { type: 'Here' },
          xcm: [
            {
              type: 'WithdrawAsset',
              value: [
                {
                  id: {
                    type: 'Concrete',
                    value: {
                      parents: 0,
                      interior: {
                        type: 'X1',
                        value: {
                          type: 'AccountKey20',
                          value: { key: '0x56072c95faa701256059aa122697b133aded9279' },
                        },
                      },
                    },
                  },
                  fun: { type: 'Fungible', value: '20000458225551204434124' },
                },
              ],
            },
            { type: 'ClearOrigin' },
            {
              type: 'BuyExecution',
              value: {
                fees: {
                  id: {
                    type: 'Concrete',
                    value: {
                      parents: 0,
                      interior: {
                        type: 'X1',
                        value: {
                          type: 'AccountKey20',
                          value: { key: '0x56072c95faa701256059aa122697b133aded9279' },
                        },
                      },
                    },
                  },
                  fun: { type: 'Fungible', value: '1' },
                },
                weight_limit: { type: 'Unlimited' },
              },
            },
            {
              type: 'DepositAsset',
              value: {
                assets: { type: 'Wild', value: { type: 'AllCounted', value: 1 } },
                beneficiary: {
                  parents: 0,
                  interior: {
                    type: 'X1',
                    value: {
                      type: 'AccountKey20',
                      value: { key: '0x9117900a3794ad6d167dd97853f82a1aa07f9bbc' },
                    },
                  },
                },
              },
            },
            { type: 'SetTopic', value: '0x90c622fc87bd8b69e064bccc450555020ac7df1d96769becb2fd6f42ddbad55e' },
          ],
        },
      },
      { type: 'SetTopic', value: '0x90c622fc87bd8b69e064bccc450555020ac7df1d96769becb2fd6f42ddbad55e' },
    ]
    const results = await humanizer.humanize({
      type: 'xcm.received',
      legs: [
        {
          from: 'urn:ocn:polkadot:1000',
          to: 'urn:ocn:polkadot:1002',
          type: 'hrmp',
          relay: 'urn:ocn:polkadot:0',
        },
      ],
      origin: {
        chainId: 'urn:ocn:polkadot:1000',
        blockHash: '0x01',
        blockNumber: 33,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions: {
          type: 'V5',
          value: instructions,
        },
      },
      waypoint: {
        chainId: 'urn:ocn:polkadot:1002',
        blockHash: '0x02',
        blockNumber: 1,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions: {
          type: 'V5',
          value: instructions,
        },
        legIndex: 1,
      },
      destination: {
        chainId: 'urn:ocn:polkadot:1002',
        blockHash: '0x02',
        blockNumber: 1,
      },
    })
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transfer')
  })

  it('should humanize transact from Bifrost to Hydration', async () => {
    const msgData =
      '00031800040000010500000b00407a10f35a130000010500000b00407a10f35a0006010700e40b5402824f1200c901ca0204010200b91f0602000100000000000000000000000000000000000000000000000000000000000004010200b91f0602010100000000000000000000000000000000000000000000000000000000000076ff61d1f7543d8e0000000000000000cf4a1ee2c422287a0000000000000000140d0100000101007369626cee0700000000000000000000000000000000000000000000000000002c5b5bb1243d6b8a84115c7d0523df44a6826284d87bf351f630aeaa74af8e9390031800040000010500000b00407a10f35a130000010500000b00407a10f35a0006010700e40b5402824f12003501ca0204010004010200b91f060209000000000000000000000000000000000000000000000000000000000000008a290405e614aa01000000000000000070dff87b6d341a010000000000000000140d0100000101007369626cee0700000000000000000000000000000000000000000000000000002cac7d685e0418ae6a3fb7368137304eac4145185508472cd9756bded8641d608f'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = fromXcmpFormat(buf, apiContext)[0].instructions

    const results = await humanizer.humanize({
      type: 'xcm.sent',
      legs: [
        {
          from: 'urn:ocn:polkadot:2030',
          to: 'urn:ocn:polkadot:2034',
          type: 'hrmp',
          relay: 'urn:ocn:polkadot:0',
        },
      ],
      origin: {
        chainId: 'urn:ocn:polkadot:2030',
        blockHash: '0x01',
        blockNumber: 33,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions,
      },
      waypoint: {
        chainId: 'urn:ocn:polkadot:2030',
        blockHash: '0x01',
        blockNumber: 33,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions,
        legIndex: 0,
      },
      destination: {
        chainId: 'urn:ocn:polkadot:2034',
      },
    })
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transact')
    expect(results.humanized.transactCalls[0]).toBeDefined()
    expect(results.humanized.transactCalls[0].raw).toBeDefined()
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.to.formatted).toBeDefined()
  })
})
