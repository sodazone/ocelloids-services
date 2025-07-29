import { pino } from 'pino'

import { ServiceConfiguration } from '@/services/config.js'
import Connector from '@/services/networking/connector.js'
import { SubstrateWatcher } from '@/services/networking/substrate/watcher/watcher.js'
import { Services } from '@/services/types.js'
import { MemoryLevel } from 'memory-level'
import { EMPTY, catchError } from 'rxjs'
import { createProxy } from './stall-proxy.js'

function createWatcher() {
  const log = pino()

  const proxy = createProxy()

  const localConfig = new ServiceConfiguration({
    substrate: {
      networks: [
        {
          id: 'urn:ocn:polkadot:0',
          provider: {
            type: 'rpc',
            url: 'ws://127.0.0.1:9999/polkadot',
          },
        },
      ],
    },
  })
  const watcher = new SubstrateWatcher({
    log,
    connector: new Connector(log, localConfig),
    levelDB: new MemoryLevel(),
    localConfig,
  } as unknown as Services)

  let blocks = 0

  watcher
    .finalizedBlocks('urn:ocn:polkadot:0')
    .pipe(
      catchError((err) => {
        console.error('Stream error:', err)
        return EMPTY
      }),
    )
    .subscribe({
      next: (block) => {
        blocks++
        if (blocks % 5 === 0) {
          proxy.toggle()
        }
        console.log('BLOCK', block.number, blocks)
      },
      error: (err) => console.error('OBSERVABLE ERROR', err),
      complete: () => console.log('OBSERVABLE COMPLETE! <<<'),
    })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  })

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
  })

  process.on('beforeExit', (code) => {
    console.log('>>> Node is about to exit with code', code)
  })
}

createWatcher()
