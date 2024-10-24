import { from, of } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
import { ApiClient, ApiContext } from '@/services/networking/index.js'

import { Binary } from 'polkadot-api'
import { messageCriteria, sendersCriteria } from '../services/agents/xcm/ops/criteria.js'
import { NetworkURN } from '../services/types.js'
import { testApiContextFromMetadata, testBlocksFrom } from './blocks.js'

export const apiContext: ApiContext = testApiContextFromMetadata('polkadot.scale')

// XCMP testing mocks
// from parachainSystem.outboundHrmpMessages 0x45323df7cc47150b3930e2666b0aa3134ec0959dca9d4616632a822d7523ba63
const xcmpData =
  '0x000314010400010300a10f043205011f00423943020a1300010300a10f043205011f0042394302000d01020400010100584de43a94c9dfc618bd7245cef1452ab9cc0cf8889cae3ee8346efc0600427e2c038bea7a3ddd9d0472337c70a7bb0189b604583fd7d8f38b670917186846536c'
export const xcmpSend = {
  origin: 'urn:ocn:local:1000' as NetworkURN,
  blocks: from(testBlocksFrom('assethub/hrmp-out_7392940.cbor')),
  sendersControl: new ControlQuery(sendersCriteria(['12znMShnYUCy6evsKDwFumafF9WsC2qPVMxLQkioczcjqudf'])),
  getHrmp: () =>
    from([
      [
        {
          recipient: 2034,
          data: Binary.fromHex(xcmpData),
        },
      ],
    ]),
}

export const xcmpReceive = {
  successBlocks: from(testBlocksFrom('hydra/hrmp-in_6253481.cbor')),
  failBlocks: from(testBlocksFrom('hydra/hrmp-in-fail_6243505.cbor')),
  trappedBlocks: from(testBlocksFrom('hydra/hrmp-in-fail_6243505.cbor')),
}

export const relayHrmpReceive = {
  blocks: from(testBlocksFrom('polkadot/hrmp-relay_23089871.cbor')),
  messageControl: new ControlQuery(
    messageCriteria(['urn:ocn:local:2034', 'urn:ocn:local:2006', 'urn:ocn:local:2104']),
  ),
  origin: 'urn:ocn:local:2034',
  destination: 'urn:ocn:local:2006',
}

// UMP testing mocks
const umpData =
  '0x0414020400000007a346f03c010a1300000007a346f03c01000d01020400010100f81641fe8a6529a467d4c2d0a81c87fe14307764d224842fb05ab836162756382c10d04544113a2aa26695ad27c151263ef6f6fe78527d6b3b05ec198a080a6f2e'
export const umpSend = {
  origin: 'urn:ocn:local:1000' as NetworkURN,
  blocks: from(testBlocksFrom('assethub/ump-out_7397884.cbor')),
  sendersControl: new ControlQuery(sendersCriteria(['14dqxCimfu8PEuneBLgZnxgyxPuMoaVto7xozL6rgSo3hGU9'])),
  getUmp: () => from([[Binary.fromHex(umpData)]]),
}

export const umpReceive = {
  successBlocks: from(testBlocksFrom('polkadot/ump-in_23088963.cbor')),
  failBlocks: from(testBlocksFrom('polkadot/ump-in-fail_23083486.cbor')),
  trappedBlocks: from(testBlocksFrom('polkadot/ump-in-fail_23083486.cbor')),
}

/*
// DMP testing mocks
const dmpData =
  '031001040001000007504dd1dc090a130001000007504dd1dc09000d01020400010100cc5aa1bd751e2a26534fa5daf5776f63192147310e2b18c52330704f5ed0a257'
const dmpData2 =
  '03140104000100000700847207020a1300010000070084720702000d0102040001010016d0e608113c3df4420993d5cc34a8d229c49bde1cad219dd01efffbfaa029032c185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c'
export const dmpSendSingleMessageInQueue = {
  origin: 'urn:ocn:local:0' as NetworkURN,
  blocks: from(testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')),
  sendersControl: new ControlQuery(sendersCriteria(['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'])),
  getDmp: () =>
    of([
      {
        msg: new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
        toU8a: () => new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
      },
    ] as unknown as any),
}

// Insert a fake message in the queue to simulate mutliple messages in DMP queue
export const dmpSendMultipleMessagesInQueue = {
  origin: 'urn:ocn:local:0' as NetworkURN,
  blocks: from(testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')),
  sendersControl: new ControlQuery(sendersCriteria(['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'])),
  getDmp: () =>
    of([
      {
        msg: new Uint8Array(Buffer.from(dmpData, 'hex')),
        toU8a: () => new Uint8Array(Buffer.from(dmpData, 'hex')),
      },
      {
        msg: new Uint8Array(Buffer.from(dmpData2, 'hex')),
        toU8a: () => new Uint8Array(Buffer.from(dmpData2, 'hex')),
      },
    ] as unknown as any),
}
*/
export const dmpXcmPalletSentEvent = {
  origin: 'urn:ocn:local:0' as NetworkURN,
  blocks: from(testBlocksFrom('polkadot/dmp-out_23090081.cbor')),
  sendersControl: new ControlQuery(sendersCriteria('*')),
  getDmp: () =>
    of([
      {
        msg: Binary.fromHex(
          '0x02100104000100000714340b0e010a13000100000300f90295010700f2052a010d01000400010100e64afe6914886cdcfea8da5f13e1e21aa11876cfe7fdde9299bbcdbbdc3a8b19',
        ),
      },
    ] as unknown as any),
}

export const dmpReceive = {
  successBlocks: from(testBlocksFrom('hydra/dmp-in_6258493.cbor')),
  failBlocks: from(testBlocksFrom('hydra/dmp-in-fail_6253890.cbor')),
}

/*
// In: DMP receive
// Out: HRMP send
export const xcmHop = {
  blocks: from(testBlocksFrom('hydra-hop-4624161.cbor.bin')),
  sendersControl: new ControlQuery(sendersCriteria('*')),
  origin: 'urn:ocn:local:0' as NetworkURN,
  destination: 'urn:ocn:local:1000' as NetworkURN,
  getHrmp: () =>
    from([
      [
        {
          recipient: {
            toNumber: () => 1000,
          },
          data: '0x0003100004000002043205011f0007f1d9052a010a13000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b03100004000002043205011f00022d31010a13000002043205011f00022d3101000d01020400010100080748a58000f274f8847e151f3c47f83aaaf2cb12835f42317de6548dcdfc34',
        },
      ],
    ]),
}

const xcmData =
  '0x0310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf'
// DMP to 2034
export const xcmHopOrigin = {
  origin: 'urn:ocn:local:0' as NetworkURN,
  blocks: from(testBlocksFrom('polkadot-hop-19777220.cbor.bin', 'polkadot-1000001.json')),
  sendersControl: new ControlQuery(sendersCriteria('*')),
  messageControl: new ControlQuery(messageCriteria(['urn:ocn:local:1000', 'urn:ocn:local:2034'])),
  getDmp: () =>
    of([
      {
        msg: new Uint8Array(Buffer.from(xcmData, 'hex')),
        asBinary: () => new Uint8Array(Buffer.from(xcmData, 'hex')),
      },
    ] as unknown as any),
}
*/
