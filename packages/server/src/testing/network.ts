import { vi } from 'vitest'

import { MemoryLevel } from 'memory-level'

import { _configToml, jwtSigKey } from './data.js'

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
