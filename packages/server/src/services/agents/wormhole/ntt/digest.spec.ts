import { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { deserializeTransferPayload } from '../mappers/payload.js'
import {
  encodeNativeTokenTransfer,
  extractEncodedNttManagerMessage,
  nttManagerMessageDigest,
  nttManagerMessageDigestFromHex,
} from './digest.js'

const transferData = {
  id: '2/00000000000000000000000099673a01c5779ebf59399b4b228c1825c0113571/4',
  emitterChain: 2,
  vaa: {
    raw: 'AQAAAAcNAO28l8xDF9LI1Wnos7Jnd8L97/wuctxHlsLbQAXXYA0UaZS77OeKBJ7smiUd0jcUqXZMdXtoOBZ8rzdIp1rrVJ8AA23ELHe1WzNAb0zQXSPCOVVCD0BPEi9wcapRgq9180VEQwhNf74JiJ/1vfoZYik1fgkh8ipXHfAUkG0YFawu77EABNKjws8Xm4x1V+TjmmBdHeKIbg24Jc2ydCkD9TuOG09GAmKzdEb6uj+g9/T7mdPazvHEhYNwENVmVanzsFkm9cMABifQ2AkpjSroelf3ZXmfkLhkaiVA0H44tpN8PpYoAOpKW74PkBhnnYE7ne7jaXYWw7HNh7dpYT8MWOGjcdxeekcBBwBFLbQfHkAjCnh9yECgi471F/1TylPoTPUavoL/04h9Y+wLpMhcHO0NwIYoDTB2qu8b6W4PCn8H4v7+PPXKFasBCCXikK3rA3XWViluXb2i3eCqvYZ8cQ6VNDI3zcnRLOVQLQQvnJFysbuRKkGFBwb4l3yyGVzEfZzLo+BS0bkbWv8BCfacuwN+rSHFYDWHKsIXKfEWXbBsd+F5udpNbFkyKNz2HzVDUoNGTl7kIz5O+3xtRvByMOsJwnwHWbAZKV8OBa8BDBjsQQW5yHdtQ0v8K8lSKPaWiLVQLVDj6G78v37AkQDTLiJy1Vhy6tFbYlPN3kiCdEM0RyE89mQSPG3kHFSWehYBDZc7RCSSrnYGPAzcC9WlZVomlnMws/Bqc7Gog5SO1c2KPVLI6io5r5Y+NWXWnvoPlA73GDS8v2FlfG2LK3641cQBDko+P2Fkw1QgNzCBp/zVhtk6kH5f0vDLgmNQ8cmTOJp6cAC2xNAxgK253npaKzjIoC2tnnbFLW9ZOOlGq3qz6rkAD8yj1OclVe5+m2pLdKN9rz7XGtYWI+BxVkqqi24PcIy1BR8/O1O0Ykhnn4aYdSxFu0I3jIxTKYwbOqlwQSlnUPgBEJq3sYwpXI6a21Dm3oijr+E2YZzZkyHXBEk2wqGZs2wDfo5HauSoBFe8CX+4Y7WK+y36W6QM760bsrXdw5HX8n4AEvQTS4t+AZj9iiTwmGdFzB4uiekoYCBJ+fSKEpDADP1CDhITV8OV9V9fl0m07d5mB7rs9gXcQ3DPed7nOeMa0y0BamuG2wAAAAAAAgAAAAAAAAAAAAAAAJlnOgHFd56/WTmbSyKMGCXAETVxAAAAAAAAAATKmUX/EAAAAAAAAAAAAAAAAIBPEj91zKCpwMujQfgvSk2oalJZAAAAAAAAAAAAAAAAz9V2+IyQhErr9FN4/QmTEoHYsU0AkQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAVT8CIgH6fIjmzBDRxoixV9b6d3UAT5lOVFQIAAAAAAX14QAAAAAAAAAAAAAAAABrF1R06JCUxE2pi5VO7erElScdDwAAAAAAAAAAAAAAAFU/AiIB+nyI5swQ0caIsVfW+nd1AEkAAA==',
  },
  content: {
    payload: {
      nttManagerMessage: {
        id: '0000000000000000000000000000000000000000000000000000000000000002',
        sender: '0x000000000000000000000000553f022201fa7c88e6cc10d1c688b157d6fa7775',
      },
      nttMessage: {
        additionalPayload: '',
        sourceToken: '0x0000000000000000000000006b175474e89094c44da98b954eedeac495271d0f',
        to: '0x000000000000000000000000553f022201fa7c88e6cc10d1c688b157d6fa7775',
        toChain: 73,
        trimmedAmount: {
          amount: '100000000',
          decimals: 8,
        },
      },
      transceiverMessage: {
        prefix: '9945ff10',
        recipientNttManager: '0x000000000000000000000000cfd576f88c90844aebf45378fd09931281d8b14d',
        sourceNttManager: '0x000000000000000000000000804f123f75cca0a9c0cba341f82f4a4da86a5259',
        transceiverPayload: '',
      },
      payloadType: 1,
      amount: '100000000',
    },
  },
}

describe('Native Token Transfer (NTT) Digest Verification', () => {
  it('should compute valid digest directly from extracted transceiver nttManagerPayload', () => {
    const rawTransceiverBytes = deserializeTransferPayload(transferData.vaa.raw) as Hex
    const encodedNttMsg = extractEncodedNttManagerMessage(rawTransceiverBytes)

    const digest = nttManagerMessageDigestFromHex(transferData.emitterChain, encodedNttMsg)

    expect(digest).toBe('0x4ae440693834eae4f4bb48e37637250fbf16b934f147cdcd228c578db5889b24')
  })

  it('should compute valid digest when re-encoding inner NativeTokenTransfer payload', () => {
    const { nttManagerMessage, nttMessage } = transferData.content.payload

    const innerNttPayload = encodeNativeTokenTransfer('0x994E5454', {
      amount: nttMessage.trimmedAmount.amount,
      decimals: nttMessage.trimmedAmount.decimals,
      sourceToken: nttMessage.sourceToken as Hex,
      to: nttMessage.to as Hex,
      toChain: nttMessage.toChain,
      additionalPayload: nttMessage.additionalPayload as Hex,
    })

    const digest = nttManagerMessageDigest(transferData.emitterChain, {
      id: `0x${nttManagerMessage.id}` as Hex,
      sender: nttManagerMessage.sender as Hex,
      payload: innerNttPayload,
    })

    expect(digest).toBe('0x4ae440693834eae4f4bb48e37637250fbf16b934f147cdcd228c578db5889b24')
  })
})
