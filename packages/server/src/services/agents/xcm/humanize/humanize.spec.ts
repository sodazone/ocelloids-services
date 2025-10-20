import { beforeEach, describe, expect, it } from 'vitest'
import { twoHopSwap } from '@/testing/2-hop-swap.js'
import { getXcmV5Sent } from '@/testing/humanize.js'
import { createServices } from '@/testing/services.js'
import { apiContext } from '@/testing/xcm.js'
import { asVersionedXcm, fromXcmpFormat } from '../ops/xcm-format.js'
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
        instructions,
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

  it('should humanize hydration evm address correctly', async () => {
    const msg =
      '0005240204010000033328164e1301000002286bee000b010450250907040104020209070403007fc66500c84a76ad7e9c93437bfc5ac33e2ddae900170040bddafe858715010a16040d01020802010907040e010208010100c91f0c13010000ce78ed49000d01020800010100455448001cc082fbc2b3a9a6456c63fec13e739c7bebc1ee00000000000000002c7a3e6325ea2b02d9ade90e5a3fcde263030085ffdf7f84dfd1217136b9a688942c7a3e6325ea2b02d9ade90e5a3fcde263030085ffdf7f84dfd1217136b9a68894'
    const buf = new Uint8Array(Buffer.from(msg, 'hex'))
    const instructions = fromXcmpFormat(buf, apiContext)[0].instructions

    const results = await humanizer.humanize({
      type: 'xcm.sent',
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
        legIndex: 0,
        chainId: 'urn:ocn:polkadot:1002',
        blockHash: '0x01',
        blockNumber: 33,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions,
      },
      destination: {
        chainId: 'urn:ocn:polkadot:2034',
      },
      sender: {
        signer: {
          id: '13Dbqvh6nLCRckyfsBr8wEJzxbi34KELwdYQFKKchN4NedGh',
          publicKey: '0x6214b4a1b4f6c2bb01a84d6f74a63c1ba72292cdecc9595e666069652189c70f',
        },
        extraSigners: [],
      },
    })
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transfer')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.to.key.length).toBe(42)
    expect(results.humanized.to.key.toLowerCase()).toBe(
      '0x1cc082fbC2b3a9A6456C63FEC13E739c7bebC1ee'.toLowerCase(),
    )
    expect(results.humanized.to.formatted).toBeUndefined()
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

  it('should return raw asset data if unable to resolve', async () => {
    const msgData =
      '0003140004000100000786b7de790313000100000786b7de79030016040d010204010100a10f260704001401040001010903000f46733b8a5d30010a130001010903000f46733b8a5d3001000d01020400010300326e5e5024e1ad738ebd3a1a724d51a94d68d3152c7692df632bb2114f55e6497579596504d207fd7cb808c593ab2a07279659898c2c7692df632bb2114f55e6497579596504d207fd7cb808c593ab2a07279659898c'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = fromXcmpFormat(buf, apiContext)[0].instructions

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
        instructions,
      },
      waypoint: {
        chainId: 'urn:ocn:polkadot:1002',
        blockHash: '0x02',
        blockNumber: 1,
        outcome: 'Success',
        messageHash: '0xBEEF',
        instructions,
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
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(1)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should humanize parachain as beneficiary', async () => {
    const msgData =
      '0418000400000003005ed0b21300000003005ed0b20006010700e40b5402020004002d011a010200630803000100b91f03000101006d6f646c62662f76746b696e0000000000000000000000000000000000000000030400000000032e57549900000000010700e40b540202000400140d010220000100b91f2ccd2964a6197dc158997fac6648b9759f6285088966952b593718f7ca6fbe3a45'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = asVersionedXcm(buf, apiContext).instructions

    const results = await humanizer.humanize({
      type: 'xcm.sent',
      legs: [
        {
          from: 'urn:ocn:polkadot:2030',
          to: 'urn:ocn:polkadot:0',
          type: 'vmp',
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
        chainId: 'urn:ocn:polkadot:0',
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
    expect(results.humanized.to.key).toBe('urn:ocn:polkadot:2030')
  })

  it('should humanize hop transfer', async () => {
    const instructions = [
      {
        type: 'WithdrawAsset',
        value: [
          {
            id: {
              parents: 0,
              interior: {
                type: 'Here',
              },
            },
            fun: {
              type: 'Fungible',
              value: '10000000',
            },
          },
        ],
      },
      {
        type: 'ClearOrigin',
      },
      {
        type: 'BuyExecution',
        value: {
          fees: {
            id: {
              parents: 0,
              interior: {
                type: 'Here',
              },
            },
            fun: {
              type: 'Fungible',
              value: '5000000',
            },
          },
          weight_limit: {
            type: 'Unlimited',
          },
        },
      },
      {
        type: 'InitiateTeleport',
        value: {
          assets: {
            type: 'Wild',
            value: {
              type: 'All',
            },
          },
          dest: {
            parents: 0,
            interior: {
              type: 'X1',
              value: {
                type: 'Parachain',
                value: 1000,
              },
            },
          },
          xcm: [
            {
              type: 'BuyExecution',
              value: {
                fees: {
                  id: {
                    parents: 1,
                    interior: {
                      type: 'Here',
                    },
                  },
                  fun: {
                    type: 'Fungible',
                    value: '5000000',
                  },
                },
                weight_limit: {
                  type: 'Unlimited',
                },
              },
            },
            {
              type: 'DepositAsset',
              value: {
                assets: {
                  type: 'Wild',
                  value: {
                    type: 'AllCounted',
                    value: 1,
                  },
                },
                beneficiary: {
                  parents: 1,
                  interior: {
                    type: 'X1',
                    value: {
                      type: 'Parachain',
                      value: 2000,
                    },
                  },
                },
              },
            },
          ],
        },
      },
    ]

    const results = await humanizer.humanize({
      type: 'xcm.received',
      legs: [
        {
          from: 'urn:ocn:polkadot:2000',
          to: 'urn:ocn:polkadot:0',
          type: 'hop',
        },
        {
          from: 'urn:ocn:polkadot:0',
          to: 'urn:ocn:polkadot:1000',
          type: 'vmp',
        },
      ],
      origin: {
        chainId: 'urn:ocn:polkadot:2000',
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
        chainId: 'urn:ocn:polkadot:0',
        blockHash: '0x02',
        blockNumber: 1,
        outcome: 'Fail',
        messageHash: '0xBEEF',
        instructions: {
          type: 'V5',
          value: instructions,
        },
        legIndex: 1,
      },
      destination: {
        chainId: 'urn:ocn:polkadot:1000',
        blockHash: '0x02',
        blockNumber: 1,
      },
    })
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transfer')
  })

  it('should resolve KSM over bridge', async () => {
    const msgData =
      '0003140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = fromXcmpFormat(buf, apiContext)[0].instructions

    const results = await humanizer.humanize({
      legs: [
        {
          from: 'urn:ocn:local:1000',
          to: 'urn:ocn:local:1002',
          type: 'hrmp',
          partialMessage: undefined,
          relay: 'urn:ocn:local:0',
        },
        {
          from: 'urn:ocn:local:1002',
          to: 'urn:ocn:kusama:1000',
          type: 'vmp',
          partialMessage: undefined,
        },
      ],
      sender: {
        signer: {
          id: '13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN',
          publicKey: '0x7279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b',
        },
        extraSigners: [],
      },
      messageId: '0x0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
      type: 'xcm.sent',
      waypoint: {
        chainId: 'urn:ocn:local:1000',
        blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
        blockNumber: '9153185',
        txHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
        timestamp: 1751014380000,
        txPosition: 6,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x0003140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
        instructions,
        messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
        legIndex: 0,
      },
      origin: {
        chainId: 'urn:ocn:local:1000',
        blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
        blockNumber: '9153185',
        txHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
        timestamp: 1751014380000,
        txPosition: 6,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x0003140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
        instructions,
        messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
      },
      destination: { chainId: 'urn:ocn:kusama:1000' },
    })

    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transfer')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(1)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should not parse empty assets when there is no asset', async () => {
    const instructions = {
      type: 'V5',
      value: [
        {
          type: 'UnpaidExecution',
          value: {
            weightLimit: {
              type: 'Unlimited',
            },
          },
        },
        {
          type: 'Transact',
          value: {
            originKind: {
              type: 'Native',
            },
            fallbackMaxWeight: {
              refTime: '1000000000',
              proofSize: '9216',
            },
            call: '0x4a027077bc01',
          },
        },
        {
          type: 'SetTopic',
          value: '0x1a4da89d738d711e284e71d640b8ed244e7a72a7d088aaeecdba0e934aa9417e',
        },
      ],
    }
    const { humanized } = await humanizer.humanize({
      legs: [
        {
          from: 'urn:ocn:local:1000',
          to: 'urn:ocn:local:1002',
          type: 'hrmp',
          partialMessage: undefined,
          relay: 'urn:ocn:local:0',
        },
        {
          from: 'urn:ocn:local:1002',
          to: 'urn:ocn:kusama:1000',
          type: 'vmp',
          partialMessage: undefined,
        },
      ],
      sender: {
        signer: {
          id: '13b6hRRYPHTxFzs9prvL2YGHQepvd4YhdDb9Tc7khySp3hMN',
          publicKey: '0x7279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b',
        },
        extraSigners: [],
      },
      messageId: '0x0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
      type: 'xcm.sent',
      waypoint: {
        chainId: 'urn:ocn:local:1000',
        blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
        blockNumber: '9153185',
        txHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
        timestamp: 1751014380000,
        txPosition: 6,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x0003140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
        instructions,
        messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
        legIndex: 0,
      },
      origin: {
        chainId: 'urn:ocn:local:1000',
        blockHash: '0xd1a8d93e59ee6acf36b1b20e9ab0272024eb69a3726415723d0caaf4498c991a',
        blockNumber: '9153185',
        txHash: '0x94ff2de94539cb2f074414d590129c6b413543235f18f2ed05419552d1692c32',
        timestamp: 1751014380000,
        txPosition: 6,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x0003140004000100002ee6f94f13000100002ee6f94f0016040d010204010100a10f26030100a10f140004000100000b46b79033fbc40a13000100000b46b79033fbc4000d010204000101007279fcf9694718e1234d102825dccaf332f0ea36edf1ca7c0358c4b68260d24b2c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd16733562c0eac6475ed479ff30d70d451385b41b776ed14c6a9ea960ec5a65f2dd1673356',
        instructions,
        messageHash: '0x63267ebd16aa5913f636a0872d4248af6b06d63299a2e365d82f401fc66fce37',
      },
      destination: { chainId: 'urn:ocn:kusama:1000' },
    })

    expect(humanized).toBeDefined()
    expect(humanized.assets.length).toBe(0)
  })

  it('should resolve humanize ExchangeAsset instruction', async () => {
    const msgData =
      '031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = asVersionedXcm(buf, apiContext).instructions

    const results = await humanizer.humanize({
      legs: [
        {
          from: 'urn:ocn:local:0',
          to: 'urn:ocn:local:1000',
          type: 'hop',
          partialMessage: undefined,
        },
        {
          from: 'urn:ocn:local:1000',
          to: 'urn:ocn:local:2030',
          type: 'hrmp',
          partialMessage:
            '0x03081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
          relay: 'urn:ocn:local:0',
        },
      ],
      sender: {
        signer: {
          id: '1phKfRLnZm8iWTq5ki2xAPf5uwxjBrEe6Bc3Tw2bxPLx3t8',
          publicKey: '0x246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
        },
        extraSigners: [],
      },
      messageId: '0xd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
      type: 'xcm.sent',
      waypoint: {
        chainId: 'urn:ocn:local:0',
        blockHash: '0xe0e851d496e7c65cd6b746de23b8735292a36795c537f609124c60a638c70ef3',
        blockNumber: '26879273',
        txHash: '0x1e6f1ec471a4fb8ba3331501ae85a30de58939281542948930b44a1b4b9d49b7',
        timestamp: 1752521214000,
        txPosition: undefined,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
        instructions,
        messageHash: '0x4a77c2eed7731aa13e441cf50c827b1b53e2e93b1c7421874aa14e2e1502c059',
        legIndex: 0,
      },
      origin: {
        chainId: 'urn:ocn:local:0',
        blockHash: '0xe0e851d496e7c65cd6b746de23b8735292a36795c537f609124c60a638c70ef3',
        blockNumber: '26879273',
        txHash: '0x1e6f1ec471a4fb8ba3331501ae85a30de58939281542948930b44a1b4b9d49b7',
        timestamp: 1752521214000,
        txPosition: undefined,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
        instructions,
        messageHash: '0x4a77c2eed7731aa13e441cf50c827b1b53e2e93b1c7421874aa14e2e1502c059',
      },
      destination: { chainId: 'urn:ocn:local:2030' },
    })

    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('swap')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(3)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should humanize ExchangeAsset instruction with actual swap values', async () => {
    const msgData =
      '031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = asVersionedXcm(buf, apiContext).instructions

    const results = await humanizer.humanize({
      legs: [
        {
          from: 'urn:ocn:local:0',
          to: 'urn:ocn:local:1000',
          type: 'hop',
          partialMessage: undefined,
        },
        {
          from: 'urn:ocn:local:1000',
          to: 'urn:ocn:local:2030',
          type: 'hrmp',
          partialMessage:
            '0x03081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
          relay: 'urn:ocn:local:0',
        },
      ],
      sender: {
        signer: {
          id: '1phKfRLnZm8iWTq5ki2xAPf5uwxjBrEe6Bc3Tw2bxPLx3t8',
          publicKey: '0x246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d37',
        },
        extraSigners: [],
      },
      messageId: '0xd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
      type: 'xcm.sent',
      waypoint: {
        chainId: 'urn:ocn:local:1000',
        txPosition: undefined,
        blockNumber: '9276853',
        blockHash: '0xe87831f4abe5bf52a019eb0bb529092c767feb7cc91869c0b42f20618722e85e',
        timestamp: 1752521220000,
        messageHash: '0xd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
        messageData: undefined,
        messageId: '0xd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
        txHash: undefined,
        outcome: 'Success',
        instructions,
        assetsTrapped: {
          event: {
            eventId: 14,
            blockNumber: '9276853',
            blockHash: '0xe87831f4abe5bf52a019eb0bb529092c767feb7cc91869c0b42f20618722e85e',
            section: 'PolkadotXcm',
            method: 'AssetsTrapped',
          },
          assets: [
            {
              version: 5,
              id: { type: 'Concrete', value: { parents: 1, interior: { type: 'Here' } } },
              fungible: true,
              amount: '144215091',
              assetInstance: undefined,
            },
          ],
          hash: '0x4ab6053ec6b034404748bc384b6c92bd3c2351c92cdbdb4f1ac87374394b4d9d',
        },
        assetSwaps: [
          {
            assetIn: {
              amount: '2497489909',
              localAssetId: { parents: 1, interior: { type: 'Here' } },
            },
            assetOut: {
              amount: '1028763',
              localAssetId: {
                parents: 0,
                interior: {
                  type: 'X2',
                  value: [
                    { type: 'PalletInstance', value: 50 },
                    { type: 'GeneralIndex', value: '1984' },
                  ],
                },
              },
            },
            event: {},
          },
        ],
        legIndex: 0,
      },
      origin: {
        chainId: 'urn:ocn:local:0',
        blockHash: '0xe0e851d496e7c65cd6b746de23b8735292a36795c537f609124c60a638c70ef3',
        blockNumber: '26879273',
        txHash: '0x1e6f1ec471a4fb8ba3331501ae85a30de58939281542948930b44a1b4b9d49b7',
        timestamp: 1752521214000,
        txPosition: undefined,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x031802040001000003005ed0b20a130001000003005ed0b2000f01010001000004000002043205011f006eca3e00000e0101000002043205011f00010100b91f081300010300a10f043205011f006eca3e00000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372cd5cd1e906668cbc0c1556fd1450310a6d9f71d593b1a3ae5a3a9c5cae8bde243',
        instructions,
        messageHash: '0x4a77c2eed7731aa13e441cf50c827b1b53e2e93b1c7421874aa14e2e1502c059',
      },
      destination: { chainId: 'urn:ocn:local:2030' },
    })

    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('swap')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(4)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should extract inner nested ExchangeAsset assets', async () => {
    const msgData =
      '031402040001000003005ed0b20a130001000003005ed0b2000e010100010000010100c91f081300010000038020998e000f0101000100000400010300a10f043205011f002eaf3a00002c4e24a286b1c562a8fc1e594bc3046b3486511c64da61f9dc064896022d447a94'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = asVersionedXcm(buf, apiContext).instructions
    const results = await humanizer.humanize({
      legs: [
        {
          from: 'urn:ocn:local:0',
          to: 'urn:ocn:local:1000',
          type: 'hop',
          partialMessage: undefined,
        },
        {
          from: 'urn:ocn:local:1000',
          to: 'urn:ocn:local:2034',
          type: 'hrmp',
          partialMessage: '0x03081300010000038020998e000f0101000100000400010300a10f043205011f002eaf3a0000',
          relay: 'urn:ocn:local:0',
        },
      ],
      sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
      messageId: '0x4e24a286b1c562a8fc1e594bc3046b3486511c64da61f9dc064896022d447a94',
      type: 'xcm.sent',
      waypoint: {
        chainId: 'urn:ocn:local:0',
        blockHash: '0xe2953a3d353b1de2128451b584754737808c4e285c0cab83658a137581b92a1c',
        blockNumber: '26875503',
        txHash: '0x5c6ad39d2589037e92089c44fb1d367bcec4089df27553228a14d487c845b158',
        timestamp: 1752498492001,
        txPosition: undefined,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x031402040001000003005ed0b20a130001000003005ed0b2000e010100010000010100c91f081300010000038020998e000f0101000100000400010300a10f043205011f002eaf3a00002c4e24a286b1c562a8fc1e594bc3046b3486511c64da61f9dc064896022d447a94',
        instructions,
        messageHash: '0x9a6aaaab796191dc5cdf8e5e35efa20ff087b430491f86cb930885656073b3d2',
        legIndex: 0,
      },
      origin: {
        chainId: 'urn:ocn:local:0',
        blockHash: '0xe2953a3d353b1de2128451b584754737808c4e285c0cab83658a137581b92a1c',
        blockNumber: '26875503',
        txHash: '0x5c6ad39d2589037e92089c44fb1d367bcec4089df27553228a14d487c845b158',
        timestamp: 1752498492001,
        txPosition: undefined,
        event: {},
        outcome: 'Success',
        error: null,
        messageData:
          '0x031402040001000003005ed0b20a130001000003005ed0b2000e010100010000010100c91f081300010000038020998e000f0101000100000400010300a10f043205011f002eaf3a00002c4e24a286b1c562a8fc1e594bc3046b3486511c64da61f9dc064896022d447a94',
        instructions,
        messageHash: '0x9a6aaaab796191dc5cdf8e5e35efa20ff087b430491f86cb930885656073b3d2',
      },
      destination: { chainId: 'urn:ocn:local:2034' },
    })

    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('swap')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(3)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should extract right beneficiary from 2 hop messages', async () => {
    const { sent } = twoHopSwap
    const msgData =
      '031801040001000003005ed0b20a130001000003005ed0b2000f0101000100000400010300a10f043205011f00f2a641000010010100010300a10f043205011f00010100a10f0813000002043205011f00eaa64100000e0101000002043205011f00010100591f081300010300a10f043205011f00b6e13600000d010100010300a10f043205011f0000010100246044e82dcb430908830f90e8c668b02544004d66eab58af5124b953ef57d372c7b234b757a973d3ffcfeca9e1a077e2c83dca86667c4d375b4eac52ab108d60c'
    const buf = new Uint8Array(Buffer.from(msgData, 'hex'))
    const instructions = asVersionedXcm(buf, apiContext).instructions

    sent.origin.instructions = instructions
    sent.waypoint.instructions = instructions

    const results = await humanizer.humanize(sent)
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('swap')
    expect(results.humanized.from).toBeDefined()
    expect(results.humanized.from.key).toBeDefined()
    expect(results.humanized.to).toBeDefined()
    expect(results.humanized.to.key).toBeDefined()
    expect(results.humanized.assets.length).toBe(3)
    expect(results.humanized.assets[0].id).toBeDefined()
    expect(results.humanized.assets[0].amount).toBeDefined()
  })

  it('should humanize XCM with InitiateTransfer instruction', async () => {
    const msg = getXcmV5Sent()
    const results = await humanizer.humanize(msg)
    expect(results.humanized).toBeDefined()
    expect(results.humanized.type).toBe('transact')
    expect(results.humanized.assets.length).toBe(2)
  })
})
