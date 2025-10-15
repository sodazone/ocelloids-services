import { NeutralHeader } from '@/services/networking/types.js'

export const scenarios = {
  ExecutedOk: () => {
    const submitted: NeutralHeader = {
      hash: '0x297c09c45a54c5eafb1479055c518661a33803017fcb87cb9d12e14f5b32626b',
      parenthash: '0xc1535a56a12340aa6d8a7f4a26d1cb3001b98cd5c414f27278b4bc4e53cae2ab',
      height: 28005777,
      status: 'finalized',
    }
    const decision: NeutralHeader = {
      hash: '0xc7555924b742c21288340fd1e2aa2a31aa83b521caed97d277cc1b4f655fa2bd',
      parenthash: '0x297c09c45a54c5eafb1479055c518661a33803017fcb87cb9d12e14f5b32626b',
      height: 28005778,
      status: 'finalized',
    }
    const confirmStarted: NeutralHeader = {
      hash: '0x82ba5b34e58bbb0eac9ea90b6c7d9ed24ce6b4e64268dc260f400ff971391a16',
      parenthash: '0xc7555924b742c21288340fd1e2aa2a31aa83b521caed97d277cc1b4f655fa2bd',
      height: 28005779,
      status: 'finalized',
    }
    const confirmed: NeutralHeader = {
      hash: '0x6be9254791cd9cd3c07a781d15c61ea133d27cbfd8a60ca56e2776727b0be14b',
      parenthash: '0x82ba5b34e58bbb0eac9ea90b6c7d9ed24ce6b4e64268dc260f400ff971391a16',
      height: 28005780,
      status: 'finalized',
    }
    const executed: NeutralHeader = {
      hash: '0x7230ef3d1282cb75cf7bc8a1b5b63930b08d91fdb7d3dd224a1d88136f18b611',
      parenthash: '0x6be9254791cd9cd3c07a781d15c61ea133d27cbfd8a60ca56e2776727b0be14b',
      height: 28005781,
      status: 'finalized',
    }
    return [submitted, decision, confirmStarted, confirmed, executed]
  },
  ExecutedFail: () => {
    const submitted: NeutralHeader = {
      hash: '0x229044d1f4f84fe1f2a14c55be8407f3673655135812ebff52de86ffbd6abd5f',
      parenthash: '0x8e0651fa8a9c5cca848b39f9d449dc16453ee4ba9241366170db2ec05c005dee',
      height: 26779258,
      status: 'finalized',
    }
    const decision: NeutralHeader = {
      hash: '0x8dedaba294835e9e0d0d143e4371a319de4d4b27556ef717ecca4a0c627d1e16',
      parenthash: '0x229044d1f4f84fe1f2a14c55be8407f3673655135812ebff52de86ffbd6abd5f',
      height: 26779259,
      status: 'finalized',
    }
    const confirmStarted: NeutralHeader = {
      hash: '0x1ea65506d26f20cac78b230116fe16ba4315b004c68397742a1b9e5df444de39',
      parenthash: '0x8dedaba294835e9e0d0d143e4371a319de4d4b27556ef717ecca4a0c627d1e16',
      height: 26779260,
      status: 'finalized',
    }
    const confirmed: NeutralHeader = {
      hash: '0xbcb4d25f15f1d314086d4a9a8f1176f19bcd4f68b398df120bde7dc2c0a305f2',
      parenthash: '0x1ea65506d26f20cac78b230116fe16ba4315b004c68397742a1b9e5df444de39',
      height: 26779261,
      status: 'finalized',
    }
    const executed: NeutralHeader = {
      hash: '0x5fad6f5880edfedb73ae19bd4e5c11d71e0a9b2b19ef3fef97d32ca726731ac1',
      parenthash: '0xbcb4d25f15f1d314086d4a9a8f1176f19bcd4f68b398df120bde7dc2c0a305f2',
      height: 26779262,
      status: 'finalized',
    }
    return [submitted, decision, confirmStarted, confirmed, executed]
  },
  Rejected: () => {
    const submitted: NeutralHeader = {
      hash: '0xd6872d3821a4a5f31b9329fc61e7ed5b9b33da9478c2c6fd32e31d01e4a10b23',
      parenthash: '0xdb33a23159f8da84807edb6d1233dadce1abc8c55b35678f4f3aa9133bf5e634',
      height: 27753923,
      status: 'finalized',
    }
    const deposit: NeutralHeader = {
      hash: '0x3486c9619cc262a08b084f013ece855e5d42bd20538b5c2dd9ba4053d9ba8381',
      parenthash: '0xd6872d3821a4a5f31b9329fc61e7ed5b9b33da9478c2c6fd32e31d01e4a10b23',
      height: 27753924,
      status: 'finalized',
    }
    const rejected: NeutralHeader = {
      hash: '0xebd3f1e4a1cbf54c3fd1583a5cc1b3b2cfefbe9f37f6368b212dc5f21539d0a2',
      parenthash: '0xd6872d3821a4a5f31b9329fc61e7ed5b9b33da9478c2c6fd32e31d01e4a10b23',
      height: 27753925,
      status: 'finalized',
    }
    return [submitted, deposit, rejected]
  },
} as const

export type ScenarioKey = keyof typeof scenarios
