// import { BN } from '@polkadot/util';
// import { ApiRx } from '@polkadot/api';

// import { Observable, from, of } from 'rxjs';
import { testBlocksFrom } from './_blocks';

export const polkadotBlocks = testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json');
// const polkadotHeaders = polkadotBlocks.map(tb => tb.block.header);

// const assetHubBlocks = testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json');
// const assetHubHeaders = assetHubBlocks.map(tb => tb.block.header);

// const interlayBlocks = testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json');
// const interlayHeaders = interlayBlocks.map(tb => tb.block.header);

// export const mockPolkadotApiRx = of({
//   rpc: {
//     chain: {
//       subscribeNewHeads: () => from(polkadotHeaders),
//       subscribeFinalizedHeads: () => from(polkadotHeaders)
//     },
//   },
//   // query: {
//   //   system: {
//   //     events: () => from(testEventRecords)
//   //   }
//   // },
//   derive: {
//     chain: {
//       getBlockByNumber: (blockNumber: BN) =>  of(
//         polkadotBlocks.find(
//           b => b.block.header.number.toBn().eq(blockNumber)
//         )
//       ),
//       subscribeNewBlocks: () => from(polkadotBlocks),
//       subscribeFinalizedHeads: () => from(polkadotHeaders),
//       getBlock: (hash: Uint8Array | string) => of(
//         polkadotBlocks.find(
//           b => b.block.hash.eq(hash)
//         )
//       )
//     },
//   },
// }) as unknown as Observable<ApiRx>;

// export const mockAssetHubApiRx = of({
//   rpc: {
//     chain: {
//       subscribeNewHeads: () => from(assetHubHeaders),
//       subscribeFinalizedHeads: () => from(assetHubHeaders)
//     },
//   },
//   // query: {
//   //   system: {
//   //     events: () => from(testEventRecords)
//   //   }
//   // },
//   derive: {
//     chain: {
//       getBlockByNumber: (blockNumber: BN) =>  of(
//         assetHubBlocks.find(
//           b => b.block.header.number.toBn().eq(blockNumber)
//         )
//       ),
//       subscribeNewBlocks: () => from(assetHubBlocks),
//       subscribeFinalizedHeads: () => from(assetHubHeaders),
//       getBlock: (hash: Uint8Array | string) => of(
//         assetHubBlocks.find(
//           b => b.block.hash.eq(hash)
//         )
//       )
//     },
//   },
// }) as unknown as Observable<ApiRx>;

// export const mockInterlayApiRx = of({
//   rpc: {
//     chain: {
//       subscribeNewHeads: () => from(interlayHeaders),
//       subscribeFinalizedHeads: () => from(interlayHeaders)
//     },
//   },
//   // query: {
//   //   system: {
//   //     events: () => from(testEventRecords)
//   //   }
//   // },
//   derive: {
//     chain: {
//       getBlockByNumber: (blockNumber: BN) =>  of(
//         interlayBlocks.find(
//           b => b.block.header.number.toBn().eq(blockNumber)
//         )
//       ),
//       subscribeNewBlocks: () => from(interlayBlocks),
//       subscribeFinalizedHeads: () => from(interlayHeaders),
//       getBlock: (hash: Uint8Array | string) => of(
//         interlayBlocks.find(
//           b => b.block.hash.eq(hash)
//         )
//       )
//     },
//   },
// }) as unknown as Observable<ApiRx>;
