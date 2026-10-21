import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'core',
      'window',
      'connector-sdk',
      'connectors/files',
      'connectors/gmail',
      'connectors/mac',
      'connectors/linkedin',
    ],
  },
})
