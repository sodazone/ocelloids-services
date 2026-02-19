import fs from 'node:fs/promises'
import path from 'node:path'

import { Gauge } from 'prom-client'

export async function dirSize(directory: string) {
  const files = await fs.readdir(directory)

  let size = 0

  for (const file of files) {
    try {
      const stat = await fs.stat(path.join(directory, file))
      size += stat.size
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      // File removed between readdir and stat, ignore
    }
  }

  return size
}

export function collectDiskStats(directory: string, opts: { name: string; help: string }) {
  const diskGauge = new Gauge(opts)

  return async () => {
    try {
      const bytes = await dirSize(directory)
      diskGauge.set(bytes)
    } catch (err) {
      console.error('disk metrics failed', err)
    }
  }
}
