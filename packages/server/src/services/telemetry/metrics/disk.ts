import path from 'node:path';
import fs from 'node:fs/promises';

import { Gauge } from 'prom-client';

export async function dirSize(directory: string) {
  const files = await fs.readdir(directory);
  const stats = files.map((file) => fs.stat(path.join(directory, file)));

  let size = 0;
  for await (const stat of stats) {
    size += stat.size;
  }
  return size;
}

export function collectDiskStats(directory: string) {
  const diskGauge = new Gauge({
    name: 'OC_root_db_disk_bytes',
    help: 'The size in bytes of the root database.',
  });

  return async () => {
    const bytes = await dirSize(directory);
    diskGauge.set(bytes);
  };
}
