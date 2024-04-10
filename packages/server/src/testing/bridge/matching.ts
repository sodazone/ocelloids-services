/*
ksm asset hub xcm out 

{
      messageData: Uint8Array(177) [
          3,  24,   0,   4,   0,   1,   0,   0,   7,  64,  86, 138,
         74,  95,  19,   0,   1,   0,   0,   7,  64,  86, 138,  74,
         95,   0,  38,   2,   1,   0, 161,  15,  20,   1,   4,   0,
          2,   1,   9,   3,   0,   7,   0, 232, 118,  72,  23,  10,
         19,   0,   2,   1,   9,   3,   0,   7,   0, 232, 118,  72,
         23,   0,  13,   1,   2,   4,   0,   1,   1,   0,  44, 183,
        131, 213, 192, 221, 204, 205,  38,   8, 200,  61,  67, 238,
        111, 193, 147,  32,  64, 140,  36, 118,  76,  47, 138, 193,
        100, 178, 123, 234,
        ... 77 more items
      ],
      recipient: 'urn:ocn:kusama:1002',
      instructions: {
        bytes: Uint8Array(177) [
            3,  24,   0,   4,   0,   1,   0,   0,   7,  64,  86, 138,
           74,  95,  19,   0,   1,   0,   0,   7,  64,  86, 138,  74,
           95,   0,  38,   2,   1,   0, 161,  15,  20,   1,   4,   0,
            2,   1,   9,   3,   0,   7,   0, 232, 118,  72,  23,  10,
           19,   0,   2,   1,   9,   3,   0,   7,   0, 232, 118,  72,
           23,   0,  13,   1,   2,   4,   0,   1,   1,   0,  44, 183,
          131, 213, 192, 221, 204, 205,  38,   8, 200,  61,  67, 238,
          111, 193, 147,  32,  64, 140,  36, 118,  76,  47, 138, 193,
          100, 178, 123, 234,
          ... 77 more items
        ],
        json: { V3: [Array] }
      },
      messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
      event: {
        extrinsicId: '6750015-2',
        extrinsicPosition: 6,
        extrinsic: {
          extrinsicId: '6750015-2',
          blockNumber: '6,750,015',
          blockHash: '0xf667f09890c8e1eee1e86a0a29fb6fe8baf5e3f36b8f92178b6d77bc115025d3',
          position: 2,
          extraSigners: [],
          isSigned: true,
          method: [Object],
          era: [Object],
          nonce: '0',
          signature: '0xf86304428e1e284267a164a3770a9953d2c0653c9ce7d8d3723782e2fbcdba6817e76d6f9e7e731741a96dc4d18ce75f4e1e929fbb53c7dcff29997f43906e8c',
          signer: [Object],
          tip: '0'
        },
        eventId: '6750015-8',
        blockPosition: 8,
        blockNumber: '6,750,015',
        blockHash: '0xf667f09890c8e1eee1e86a0a29fb6fe8baf5e3f36b8f92178b6d77bc115025d3',
        method: 'XcmpMessageSent',
        section: 'xcmpQueue',
        index: '0x1e04',
        data: {
          messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534'
        }
      },
      blockHash: '0xf667f09890c8e1eee1e86a0a29fb6fe8baf5e3f36b8f92178b6d77bc115025d3',
      blockNumber: '6750015',
      sender: {
        signer: {
          id: 'Dax95Nps5EEVfw7eQ2mvB3bX8p2hX2ZCtYSLiA357ZRq3aK',
          publicKey: '0x2cb783d5c0ddcccd2608c83d43ee6fc19320408c24764c2f8ac164b27beaee37'
        },
        extraSigners: []
      },
      extrinsicId: '6750015-2',
      messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d'
    }

kusama relay

{
  event: undefined,
  extrinsicId: '22648011-1',
  blockNumber: '22648011',
  blockHash: '0x088f00fb7cbeee77dabaeac12b21faff63d22ab16d3bcd297f3b6874519edac9',
  messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
  messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
  recipient: 'urn:ocn:kusama:1002',
  origin: 'urn:ocn:kusama:1000',
  outcome: 'Success',
  error: null
}

kusama bridge hub xcm in

{
      event: {
        eventId: '3076892-4',
        blockPosition: 4,
        blockNumber: '3,076,892',
        blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
        method: 'Success',
        section: 'xcmpQueue',
        index: '0x1e00',
        data: {
          messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
          messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
          weight: [Object]
        }
      },
      extrinsicId: undefined,
      blockNumber: '3076892',
      blockHash: '0xb97d57e388c812f755dbfa025ba67f1347fac1adfb81caf5b0fb48653f7f40d2',
      messageHash: '0xcf69513b918016ce164ca069dba5f3069528c54323998b4387d57e715f1a2534',
      messageId: '0x4b422c686214e14cc3034a661b6a01dfd2c9a811ef9ec20ef798d0e687640e6d',
      outcome: 'Success',
      error: undefined,
      assetsTrapped: undefined
    }
*/

/*
Polkadot bridge hub xcm out

{
      messageData: Uint8Array(116) [
          3,  32,  11,   1,   4,  53,  37,   9,   3,  11,   1,  0,
        161,  15,   1,   4,   0,   2,   1,   9,   3,   0,   7,  0,
        232, 118,  72,  23,  10,  19,   0,   2,   1,   9,   3,  0,
          7,   0, 232, 118,  72,  23,   0,  13,   1,   2,   4,  0,
          1,   1,   0,  44, 183, 131, 213, 192, 221, 204, 205, 38,
          8, 200,  61,  67, 238, 111, 193, 147,  32,  64, 140, 36,
        118,  76,  47, 138, 193, 100, 178, 123, 234, 238,  55, 44,
        247, 210, 241,  50, 148,  76,  12,  81, 139,  76, 134, 45,
        110, 104,   3,  15,
        ... 16 more items
      ],
      recipient: 'urn:ocn:polkadot:1000',
      instructions: {
        bytes: Uint8Array(116) [
            3,  32,  11,   1,   4,  53,  37,   9,   3,  11,   1,  0,
          161,  15,   1,   4,   0,   2,   1,   9,   3,   0,   7,  0,
          232, 118,  72,  23,  10,  19,   0,   2,   1,   9,   3,  0,
            7,   0, 232, 118,  72,  23,   0,  13,   1,   2,   4,  0,
            1,   1,   0,  44, 183, 131, 213, 192, 221, 204, 205, 38,
            8, 200,  61,  67, 238, 111, 193, 147,  32,  64, 140, 36,
          118,  76,  47, 138, 193, 100, 178, 123, 234, 238,  55, 44,
          247, 210, 241,  50, 148,  76,  12,  81, 139,  76, 134, 45,
          110, 104,   3,  15,
          ... 16 more items
        ],
        json: { V3: [Array] }
      },
      messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
      event: {
        extrinsicId: '2340207-2',
        extrinsicPosition: 5,
        extrinsic: {
          extrinsicId: '2340207-2',
          blockNumber: '2,340,207',
          blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
          position: 2,
          extraSigners: [],
          isSigned: true,
          method: [Object],
          era: [Object],
          nonce: '242',
          signature: '0xf4313be9d56930a6bcdf4d487362db73e72dd09903a672476b94e67f061e8f2e7bd80074b5d63c319f678c7d753d38afecc546f24ca67f4ca5f2098cd4aca68e',
          signer: [Object],
          tip: '0'
        },
        eventId: '2340207-7',
        blockPosition: 7,
        blockNumber: '2,340,207',
        blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
        method: 'XcmpMessageSent',
        section: 'xcmpQueue',
        index: '0x1e04',
        data: {
          messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203'
        }
      },
      blockHash: '0xbbcaec547ab8473aed6cfafa3b5f0e15037f44c1bd462300c0bc1ca53ad2e28a',
      blockNumber: '2340207',
      sender: {
        signer: {
          id: '1W4WxmnXHU1cMVXuT8qmp9XSxQyzNQNu4mMB9PeNg32JdBF',
          publicKey: '0x1629f45fd0f1bdbfcd46142c8519e4da2967832e025b30232bddc8bba699ec7a'
        },
        extraSigners: []
      },
      extrinsicId: '2340207-2',
      messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab'
    }

Polkadot relay

{
  event: undefined,
  extrinsicId: '20252960-1',
  blockNumber: '20252960',
  blockHash: '0xb3527df9a1f18c0adeebf3455f6979479b482be6c0f2eab1bdd1aa842bff0449',
  messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
  messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
  recipient: 'urn:ocn:polkadot:1000',
  origin: 'urn:ocn:polkadot:1002',
  outcome: 'Success',
  error: null
}

Polkadot asset hub xcm in

{
  event: {
    eventId: '6019226-3',
    blockPosition: 3,
    blockNumber: '6,019,226',
    blockHash: '0x61cb784a7c3491e0e14aeb9c0417b123d2708a2ef633db3f7a4e516b02ee230c',
    method: 'Success',
    section: 'xcmpQueue',
    index: '0x1e00',
    data: {
      messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
      messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
      weight: [Object]
    }
  },
  extrinsicId: undefined,
  blockNumber: '6019226',
  blockHash: '0x61cb784a7c3491e0e14aeb9c0417b123d2708a2ef633db3f7a4e516b02ee230c',
  messageHash: '0x96761b9d2231070c8f80c46976fa3682f3eee734ffad11bfa722f3c2d0386203',
  messageId: '0xf7d2f132944c0c518b4c862d6e68030f0ba49808125a805a11a9ede30d0410ab',
  outcome: 'Success',
  error: undefined,
  assetsTrapped: undefined
}

*/