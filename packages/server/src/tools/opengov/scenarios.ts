import { NeutralHeader } from '@/services/networking/types.js'

export const scenarios = {
  Timeout: () => {
    const submitted: NeutralHeader = {
      hash: '0x1e5c50280cb68834e50f05a29ec7685772466360f77a29d3393806a38b920cc8',
      parenthash: '0x42bb80074506845a5490b7cfbfe1012aefa9275a35de1a81951da309ebad6b69',
      height: 27778247,
      status: 'finalized',
    }
    const timeout: NeutralHeader = {
      hash: '0x5daec263df90a7b33e19719febcc99d187eee1a4905c5a35b3671a37b64a69ff',
      parenthash: '0x1e5c50280cb68834e50f05a29ec7685772466360f77a29d3393806a38b920cc8',
      height: 27778248,
      status: 'finalized',
    }
    return [submitted, timeout]
  },
  Cancelled: () => {
    const submitted: NeutralHeader = {
      hash: '0x94002749dc4546500ae0046a7f200799437ca59c5de6e0787b1fb06371a8b5bc',
      parenthash: '0x854f2e7abc1856921311388226e1dc1f8c3fc31c76398fb3682cc408a56150aa',
      height: 22774574,
      status: 'finalized',
    }
    const deposit: NeutralHeader = {
      hash: '0x6a0e7c7531c5611cee66c4020d0eef4887ebd4b4c8bca1a398f1f0f89daefe7e',
      parenthash: '0x94002749dc4546500ae0046a7f200799437ca59c5de6e0787b1fb06371a8b5bc',
      height: 22774575,
      status: 'finalized',
    }
    const cancelled: NeutralHeader = {
      hash: '0x962bc2f8616f7c3de0496fc4145dde3defb322404f8ef2e04aa2dc828120bdd8',
      parenthash: '0x6a0e7c7531c5611cee66c4020d0eef4887ebd4b4c8bca1a398f1f0f89daefe7e',
      height: 22774576,
      status: 'finalized',
    }
    return [submitted, deposit, cancelled]
  },
  Killed: () => {
    const submitted: NeutralHeader = {
      hash: '0xe8ef81df523614046cb9857b362e0ce329d96a12c619d3ae59c73ec87392bc9e',
      parenthash: '0x393b56127b798dfb0e05dbfa363bf4da2c0a74690e71808dc8b166277a02ab72',
      height: 17784630,
      status: 'finalized',
    }
    const deposit: NeutralHeader = {
      hash: '0xf3932d3577589e3ec8dc3cd21b41312f5e74fa75f12aedfe0cf1714c6b5669a0',
      parenthash: '0xe8ef81df523614046cb9857b362e0ce329d96a12c619d3ae59c73ec87392bc9e',
      height: 17784631,
      status: 'finalized',
    }
    const killed: NeutralHeader = {
      hash: '0x589098b2ab70c3d984121d9fa686077ad5206e99b0eaacecef0883ab9b611b6a',
      parenthash: '0xf3932d3577589e3ec8dc3cd21b41312f5e74fa75f12aedfe0cf1714c6b5669a0',
      height: 17784632,
      status: 'finalized',
    }
    return [submitted, deposit, killed]
  },
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
