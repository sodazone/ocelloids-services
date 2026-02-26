import { toBinary } from '@/common/util.js'
import { HexString } from '@/services/subscriptions/types.js'

export function toFrontierRuntimeQuery({
  callData,
  contractAddress,
}: {
  callData: HexString
  contractAddress: HexString
}) {
  return {
    api: 'EthereumRuntimeRPCApi',
    method: 'call',
    args: [
      toBinary('0x0000000000000000000000000000000000000000'),
      toBinary(contractAddress),
      toBinary(callData),
      [0n, 0n, 0n, 0n],
      [30000000000n, 0n, 0n, 0n],
      undefined,
      undefined,
      undefined,
      false,
      undefined,
    ],
  }
}
