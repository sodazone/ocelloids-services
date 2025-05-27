import { from, of } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'

import { Binary } from 'polkadot-api'
import { messageCriteria, sendersCriteria } from '../services/agents/xcm/ops/criteria.js'
import { NetworkURN } from '../services/types.js'
import { testApiContextFromMetadata, testBlocksFrom } from './blocks.js'

export const apiContext: SubstrateApiContext = testApiContextFromMetadata('polkadot.scale')
export const apiContext_xcmv2: SubstrateApiContext = testApiContextFromMetadata('polkadot.xcmv2.scale')

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

const umpV5Instructions =
  '0x051402040000000ba3a4233a8c040a130000000ba3a4233a8c04000d0102040001010060775b26d682d631278127b4f2b6c3b9f4382497c566c9c9fab2e9d73119875c2c25bf077c7a169516951c5f9959af38729757d61da4e2389da703ec04beb79b12'
export const umpV5Send = {
  origin: 'urn:ocn:local:1000' as NetworkURN,
  blocks: from(testBlocksFrom('assethub/8933756.cbor')),
  sendersControl: new ControlQuery(sendersCriteria(['13BV45b5dHe3EAsVJ3qDq4VA671nwyyk51UU31no7Kx1CCnF'])),
  getUmp: () => from([[Binary.fromHex(umpV5Instructions)]]),
}

export const umpReceive = {
  successBlocks: from(testBlocksFrom('polkadot/26185925.cbor')),
  failBlocks: from(testBlocksFrom('polkadot/ump-in-fail_23083486.cbor')),
  trappedBlocks: from(testBlocksFrom('polkadot/ump-in-fail_23083486.cbor')),
}

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
  dmpByBock: from(testBlocksFrom('moonbeam/9166777.cbor')),
  successBlocks: from(testBlocksFrom('hydra/dmp-in_6258493.cbor')),
  failBlocks: from(testBlocksFrom('hydra/dmp-in-fail_6253890.cbor')),
}
