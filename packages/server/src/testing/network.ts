import { MemoryLevel } from 'memory-level'
import { of } from 'rxjs'
import { vi } from 'vitest'

import { _configToml, jwtSigKey } from './data.js'

vi.mock('../services/networking/substrate/client.js', () => {
  class MockSubstrateClient {
    connect() {
      return Promise.resolve(this)
    }
    isReady() {
      return Promise.resolve({
        followHeads$: of({}),
      })
    }
    disconnect = vi.fn()
  }

  return { SubstrateClient: MockSubstrateClient }
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
