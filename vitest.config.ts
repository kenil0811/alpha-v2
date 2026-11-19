import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'core',
      'window',
      'connector-sdk',
      'bridge',
      'plugin-sdk',
      'connectors/files',
      'connectors/gmail',
      'connectors/google',
      'connectors/outlook',
      'connectors/quickbooks',
      'connectors/mac',
      'connectors/computer',
      'connectors-extra/linkedin',
    ],
  },
})
