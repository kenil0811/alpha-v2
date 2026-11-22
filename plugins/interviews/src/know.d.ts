import type { Input, PluginHost } from '@alpha/plugin-sdk'
import { z } from 'zod'
export interface Story {
  reading: boolean
  read: string | null
  found: {
    key: string
    name: string
    on: boolean
    words: string
    shown?: string[]
  }[]
  site: {
    url: string
    text: string
  }[]
  drafting: boolean
  rounds: number
  problem: string | null
}
export declare const storyOf: (host: PluginHost, person: string) => Story
export declare function keepStory(host: PluginHost, person: string, change: Partial<Story>): Story
export declare function shownOf(words: string): string[]
export type Who = Input['person']
export declare function sourcesFor(
  host: PluginHost,
  who: Who,
): {
  key: string
  name: string
  reads: string
  has: string
  available: boolean
}[]
export declare const knowScreen: (
  host: PluginHost,
  who: Who,
) => {
  says: string
  sources: {
    key: string
    name: string
    reads: string
    has: string
    available: boolean
  }[]
  reading: boolean
  found: {
    key: string
    name: string
    on: boolean
    words: string
    shown?: string[]
  }[]
}
export declare function readAll(host: PluginHost, who: Who, off: string[]): Promise<void>
export declare const KnowBody: z.ZodObject<
  {
    off: z.ZodDefault<z.ZodArray<z.ZodString>>
  },
  z.core.$strip
>
