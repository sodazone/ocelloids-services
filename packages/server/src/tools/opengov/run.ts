import { OpenGov } from '@/services/agents/opengov/agent.js'
import { NeutralHeader } from '@/services/networking/types.js'
import { initRuntime } from './ctx.js'

async function main() {
  const { ctx, services, connector } = initRuntime()

  const agent = new OpenGov(ctx)
  agent.start()

  agent.subscribe({
    ephemeral: false,
    agent: 'opengov',
    id: 'test',
    owner: 'test',
    public: true,
    channels: [],
    args: {
      networks: ['urn:ocn:polkadot:0'],
    },
  })

  console.log('🧠 OpenGov agent running. Press Ctrl+C to exit.')

  await new Promise((res) => setTimeout(res, 5_000))

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

  for (const h of [submitted, decision, confirmStarted, confirmed]) {
    connector.reportFinalizedBlock('urn:ocn:polkadot:0', h)
    await new Promise((res) => setTimeout(res, 1_000))
  }

  // Keep the process alive until Ctrl+C
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      console.log('\nCaught SIGINT, shutting down...')
      resolve()
    })
    process.on('SIGTERM', () => {
      console.log('\n🛑 Caught SIGTERM, shutting down...')
      resolve()
    })
  })

  // Graceful cleanup
  agent.stop?.()
  await services.connector.disconnectAll?.()

  console.log('✅ Shutdown complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Fatal error in main loop:', err)
  process.exit(1)
})
