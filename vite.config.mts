import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vite.setup.mts'],
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx']
  }
})
