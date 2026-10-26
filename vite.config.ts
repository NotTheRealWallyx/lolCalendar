import { defineConfig } from 'vite'
import { FEED_PATH, SERVER_PORT } from './shared/config.ts'

const serverUrl = `http://localhost:${SERVER_PORT}`

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': serverUrl,
      [FEED_PATH]: serverUrl,
    },
  },
})
