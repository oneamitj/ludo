import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the build works at https://<user>.github.io/ludo/
  // and from any other folder without changes.
  base: './',
  plugins: [react()],
  server: { port: 5180 },
  preview: { port: 5181 },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
