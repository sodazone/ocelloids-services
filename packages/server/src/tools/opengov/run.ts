import { OpenGov } from '@/services/agents/opengov/agent.js'
import { initRuntime } from './ctx.js'
import { InjectableConnector } from './inject.js'
import { ScenarioKey, scenarios } from './scenarios.js'

async function injectBlockHeaders(scenario: ScenarioKey, connector: InjectableConnector) {
  const headers = scenarios[scenario]()
  for (const h of headers) {
    connector.reportFinalizedBlock('urn:ocn:polkadot:0', h)
    await new Promise((res) => setTimeout(res, 1_000))
  }
}

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

  await injectBlockHeaders('ExecutedFail', connector)

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

  agent.stop?.()
  await services.connector.disconnectAll?.()

  console.log('✅ Shutdown complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Fatal error in main loop:', err)
  process.exit(1)
})
