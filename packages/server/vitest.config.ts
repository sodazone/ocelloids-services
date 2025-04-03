import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import configPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    configPaths()
  ],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text'],
      reportOnFailure: true,
      provider: "v8",
      exclude: [
        'dist/',
        'vitest.config.ts',
        'src/testing/',
        'src/services/telemetry/metrics',
        'src/services/agents/xcm/telemetry',
        'src/services/agents/xcm/lib.ts',
        'src/services/limit.ts',
        'src/services/ingress',
        'src/services/networking/substrate/public-types.ts',
        'src/services/networking/substrate/ingress/consumer/distributed.ts',
        'src/services/networking/substrate/ingress',
        'src/services/networking/substrate/client',
        'src/services/networking/bitcoin',
        'src/services/networking/index.ts',
        'src/services/agents/steward/*.ts',
        'src/services/agents/chainspy/*.ts',
        'src/services/persistence/level/index.ts',
        'src/lib.ts',
        'src/main.ts',
        'src/cli',
        '**/*.spec.*'
      ]
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
