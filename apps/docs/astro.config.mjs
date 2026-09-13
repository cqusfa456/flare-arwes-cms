import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  integrations: [react()],
  outDir: 'build',
  build: {
    format: 'directory'
  },
  // Links to pages the browser has to load (CMS pages, collection indexes) are
  // prefetched as they come into view, so the view transition has the new document
  // ready instead of showing the old page for the length of the round trip.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
