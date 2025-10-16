import { once } from 'node:events'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { cwd, exit } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { pino } from 'pino'
import toml from 'toml'

import { $ServiceConfiguration, ServiceConfiguration } from '@/services/config.js'
import Connector from '@/services/networking/connector.js'
import { SubstrateWatcher } from '@/services/networking/substrate/watcher/watcher.js'
import type { NetworkURN, Services } from '@/services/types.js'
import { MemoryLevel } from 'memory-level'

/**
 * Integration test:
 * Connects to real chains using Connector + config.toml,
 * subscribes to finalized blocks, forces disconnect,
 * and ensures telemetryApiReconnect fires.
 */

const CONFIG_FILE = process.argv[2] ?? './config/relay.toml'
const TEST_CHAIN = (process.env.TEST_CHAIN_ID ?? 'urn:ocn:polkadot:0') as NetworkURN

async function main() {
  console.log(`[TEST] Loading config from ${CONFIG_FILE}`)
  const configPath = resolve(cwd(), CONFIG_FILE)
  const raw = fs.readFileSync(configPath, 'utf-8')
  const parsed = toml.parse(raw)
  const config = new ServiceConfiguration($ServiceConfiguration.parse(parsed))

  const log = pino({
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, singleLine: true },
    },
  })

  console.log(`[TEST] Using real Connector for chainId=${TEST_CHAIN}`)
  const connector = new Connector(log, config)
  connector.connectAll('substrate')
  const watcher = new SubstrateWatcher({
    log,
    connector,
    levelDB: new MemoryLevel(),
    localConfig: config,
  } as unknown as Services)

  watcher.on('telemetryApiReconnect', ({ chainId }) => {
    log.info(`[TEST] telemetryApiReconnect emitted for ${chainId}`)
  })

  log.info(`[TEST] Connecting to ${TEST_CHAIN}...`)
  const finalized$ = watcher.finalizedBlocks(TEST_CHAIN)

  const sub = finalized$.subscribe({
    next: (block) => log.info(`[BLOCK] ${block.hash}`),
    error: (err) => log.error(`[ERR]`, err),
    complete: () => log.info('[FIN] Subscription completed'),
  })

  log.info('[TEST] Waiting for first few finalized blocks...')
  await delay(15_000)

  log.warn('[TEST] Forcing disconnection to simulate failure...')
  await connector.disconnect('substrate', TEST_CHAIN)

  log.info('[TEST] Waiting for telemetryApiReconnect event...')
  await Promise.race([
    once(watcher, 'telemetryApiReconnect'),
    // 5 minutes for watchdog to kick in
    delay(6 * 60_000).then(() => {
      throw new Error('Timeout waiting for telemetryApiReconnect')
    }),
  ])

  log.info('[TEST] Reconnect confirmed ✅')

  sub.unsubscribe()
  await watcher.stop()
  exit(0)
}

main().catch((err) => {
  console.error('[FATAL]', err)
  exit(1)
})
