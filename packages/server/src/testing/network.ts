import { MemoryLevel } from 'memory-level'
import { vi } from 'vitest'

import { _configToml, jwtSigKey } from './data.js'

vi.mock('../services/networking/substrate/client.js', () => {
  return {
    ArchiveClient: vi.fn().mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        isReady: vi.fn().mockResolvedValue({}),
        disconnect: vi.fn(),
      }),
      isReady: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn(),
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
