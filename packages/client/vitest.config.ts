import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      exclude: [
        '**/docs/**',
        '**/test/**',
        '**/dist/**',
        'vitest.config.ts'
      ]
    }
  },
})