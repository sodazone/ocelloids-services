import { from, of } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
import { ApiClient, ApiContext } from '@/services/networking/index.js'

import { messageCriteria, sendersCriteria } from '../services/agents/xcm/ops/criteria.js'
import { NetworkURN } from '../services/types.js'
import { testApiContextFromMetadata, testBlocksFrom } from './blocks.js'

export const apiContext: ApiContext = testApiContextFromMetadata('polkadot.scale')

// XCMP testing mocks
const xcmpData =
  '0x000310010400010300a10f043205011f00034cb0a37d0a1300010300a10f043205011f00034cb0a37d000d010204000101008e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368'
export const xcmpSend = {
  origin: 'urn:ocn:local:1000' as NetworkURN,
  blocks: from(testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json')),
  sendersControl: new ControlQuery(sendersCriteria(['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'])),
  getHrmp: () =>
    from([
      [
        {
          recipient: {
            toNumber: () => 2032,
          },
          data: xcmpData,
        },
      ],
    ]),
}

export const xcmpReceive = {
  successBlocks: from(testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json')),
  failBlocks: from(testBlocksFrom('hrmp-in-2032-fail.cbor.bin', 'interlay.json')),
  trappedBlocks: from(testBlocksFrom('hrmp-2032-trapped-3781567.cbor.bin', 'interlay.json')),
}

// UMP testing mocks
const umpData =
  '0x03100204000000000700fcf9d8080a13000000000700fcf9d808000d01020400010100a0ce523c0e0ce46845d3fe6258d0e314e029bbcdd96e19646cc4ffd395ff0e5e'
export const umpSend = {
  origin: 'urn:ocn:local:1000' as NetworkURN,
  blocks: from(testBlocksFrom('ump-out-1000.cbor.bin', 'asset-hub.json')),
  sendersControl: new ControlQuery(sendersCriteria(['14dqxCimfu8PEuneBLgZnxgyxPuMoaVto7xozL6rgSo3hGU9'])),
  getUmp: () => from([[umpData]]),
}

export const umpReceive = {
  successBlocks: from(testBlocksFrom('ump-in-success.cbor.bin', 'polkadot.json')),
  failBlocks: from(testBlocksFrom('ump-in-fail.cbor.bin', 'polkadot.json')),
  trappedBlocks: from(testBlocksFrom('ump-0-trapped-19511591.cbor.bin', 'polkadot-1000001.json')),
}

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

export const dmpXcmPalletSentEvent = {
  origin: 'urn:ocn:local:0' as NetworkURN,
  blocks: from(testBlocksFrom('dmp-out-event-19505060.cbor.bin', 'polkadot-1000001.json')),
  sendersControl: new ControlQuery(sendersCriteria('*')),
  getDmp: () =>
    of([
      {
        msg: new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
        toU8a: () => new Uint8Array(Buffer.from('0002100004000000001700004b3471bb156b050a1300000000', 'hex')),
      },
    ] as unknown as any),
}

export const dmpReceive = {
  successBlocks: from(testBlocksFrom('dmp-in-1000-success.cbor.bin', 'asset-hub.json')),
  failBlocks: from(testBlocksFrom('dmp-in-1000-fail.cbor.bin', 'asset-hub.json')),
  trappedBlocks: from(testBlocksFrom('dmp-2034-trapped-4159643.cbor.bin', 'hydra-201.json')),
  api: {} as unknown as ApiClient,
}

export const relayHrmpReceive = {
  blocks: from(testBlocksFrom('relay-hrmp-19507696.cbor.bin', 'polkadot.json')),
  messageControl: new ControlQuery(
    messageCriteria(['urn:ocn:local:2000', 'urn:ocn:local:2006', 'urn:ocn:local:2104']),
  ),
  origin: 'urn:ocn:local:2004',
  destination: 'urn:ocn:local:2104',
}

// In: DMP receive
// Out: HRMP send
export const xcmHop = {
  blocks: from(testBlocksFrom('hydra-hop-4624161.cbor.bin', 'hydra-207.json')),
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
