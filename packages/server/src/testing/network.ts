import { MemoryLevel } from 'memory-level'
import { of } from 'rxjs'
import { vi } from 'vitest'

import { _configToml, jwtSigKey } from './data.js'

vi.mock('../services/networking/substrate/client.js', () => {
  const isReady = () =>
    Promise.resolve({
      followHeads$: of({}),
    })
  const disconnect = vi.fn()
  return {
    SubstrateClient: vi.fn().mockReturnValue({
      connect: () =>
        Promise.resolve({
          isReady,
          disconnect,
        }),
      isReady,
      disconnect,
    }),
  }
})

vi.mock('node:fs', () => {
  return {
    default: {
      existsSync: () => true,
      readFileSync: (file: string) => {
        if (file === 'keys') {
          return jwtSigKey
        }
        return _configToml
      },
    },
  }
})

vi.mock('level', async () => {
  return { Level: MemoryLevel }
})
