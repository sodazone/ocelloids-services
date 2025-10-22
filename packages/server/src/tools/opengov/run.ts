import { OpenGov } from '@/services/agents/opengov/agent.js'
import { initRuntime } from './ctx.js'
import { InjectableConnector } from './inject.js'
import { ScenarioKey, scenarios } from './scenarios.js'

async function delay(ms: number) {
  console.log(`<waiting ${ms / 1_000}s>`)
  await new Promise((res) => setTimeout(res, ms))
}

async function injectBlockHeaders(scenario: ScenarioKey, connector: InjectableConnector) {
  const headers = scenarios[scenario]()
  for (const h of headers) {
    connector.reportFinalizedBlock('urn:ocn:polkadot:0', h)
    await delay(1_000)
  }
}

async function main(scenario: ScenarioKey) {
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

  console.log(`🧠 OpenGov agent running [${scenario}]`)

  await delay(5_000)
  await injectBlockHeaders(scenario, connector)

  agent.stop?.()
  await services.connector.disconnectAll?.()

  console.log('✅ Shutdown complete.')
  process.exit(0)
}

main('Timeout').catch((err) => {
  console.error('❌ Fatal error in main loop:', err)
  process.exit(1)
})
