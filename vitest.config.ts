import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'core',
      'window',
      'connector-sdk',
      'plugin-sdk',
      'connectors/files',
      'connectors/gmail',
      'connectors/outlook',
      'connectors/mac',
      'connectors-extra/linkedin',
    ],
  },
})
