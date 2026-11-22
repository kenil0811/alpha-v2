import type { PluginHost } from '@alpha/plugin-sdk'
export interface Found {
  words: string
  cites: string[]
  text: string
}
export interface Source {
  key: string
  name: string
  asks: string
  reads: string
  connectors: string[]
  atInterview?: boolean
  read(host: PluginHost, person: string, days: number): Found
  lines(host: PluginHost, person: string, days: number): string[]
}
export declare const connected: (host: PluginHost, s: Source) => boolean
export declare const SOURCES: Source[]
export declare const sourceOf: (key: string) => Source | undefined
