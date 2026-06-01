import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // exFAT/NTFS-shared drive creates macOS AppleDouble sidecars (._foo.test.ts)
    // that vitest mistakes for real tests; skip them explicitly.
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/__tests__/**'],
    },
  },
})
