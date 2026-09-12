import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['astro', 'astro/zod', 'astro/loaders', '@sci-fi-cms/core'],
  target: 'es2022',
})
