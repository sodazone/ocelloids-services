import fs from 'node:fs/promises'
import path from 'node:path'

import { Gauge } from 'prom-client'

export async function dirSize(directory: string) {
  const files = await fs.readdir(directory)
  const stats = files.map((file) => fs.stat(path.join(directory, file)))

  let size = 0
  for await (const stat of stats) {
    size += stat.size
  }
  return size
}

export function collectDiskStats(directory: string, opts: { name: string; help: string }) {
  const diskGauge = new Gauge(opts)

  return async () => {
    const bytes = await dirSize(directory)
    diskGauge.set(bytes)
  }
}
