import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

describe('the window', () => {
  it('draws Home with the core version', () => {
    expect(renderToString(<App health={{ ok: true, version: '0.0.0' }} />)).toContain('Alpha 0.0.0')
  })
})
