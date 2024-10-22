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
      provider: "v8"
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
