import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Run test files sequentially in a single fork to keep peak memory low.
    // The full jsdom suite can otherwise exhaust the JS heap on constrained
    // environments (the worker crashes with "heap out of memory").
    pool: 'forks',
    poolOptions: {
      // Raise the worker heap so the jsdom suite has headroom (workers don't
      // inherit the parent's NODE_OPTIONS, so the flag must be passed here).
      forks: {
        execArgv: ['--max-old-space-size=4096'],
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/{test,tests,__tests__}/**',
        '**/test-utils.{js,ts,jsx,tsx}',
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})