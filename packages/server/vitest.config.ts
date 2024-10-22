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
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
