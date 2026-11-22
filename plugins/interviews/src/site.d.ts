import type { Found } from './sources.ts'
export declare const wordsOf: (html: string) => string
export declare function linksIn(html: string, base: URL): URL[]
export interface SitePages {
  pages: {
    url: string
    text: string
  }[]
}
export declare function readSite(address: string): Promise<
  SitePages & {
    found: Found
  }
>
