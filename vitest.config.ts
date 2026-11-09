import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@/app': path.resolve(__dirname, 'app') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    env: { SITES_DATA_DIR: path.resolve(__dirname, 'data', 'sites') },
  },
})
