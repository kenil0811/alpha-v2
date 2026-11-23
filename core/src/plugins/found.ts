// Finding Alpha's plugins: every folder in plugins/ checked as a plugin, and of those the ones
// alpha.yaml's plugins line names (rules P1).
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkPlugin, type Plugin } from '@alpha/plugin-sdk'
import { entryOf } from '../connectors/discover.ts'

export const PLUGINS_DIR = join(import.meta.dirname, '..', '..', '..', 'plugins')

export interface Loaded {
  plugin: Plugin
  dir: string
}

// Every plugin in a folder, checked; the folders that did not load, with why.
export async function loadPlugins(
  dir: string,
): Promise<{ plugins: Loaded[]; failed: { folder: string; why: string }[] }> {
  const plugins: Loaded[] = []
  const failed: { folder: string; why: string }[] = []
  let names: string[] = []
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return { plugins, failed }
  }
  for (const name of names) {
    const folder = join(dir, name)
    try {
      const mod = (await import(pathToFileURL(entryOf(folder)).href)) as { plugin?: unknown }
      const problems = checkPlugin(
        mod.plugin,
        plugins.map((p) => p.plugin.name),
      )
      if (problems.length) throw new Error(problems.join(' '))
      plugins.push({ plugin: mod.plugin as Plugin, dir: folder })
    } catch (err) {
      failed.push({ folder, why: err instanceof Error ? err.message : String(err) })
    }
  }
  return { plugins, failed }
}

// Of the plugins found, those alpha.yaml's plugins line names; what kept a named one from loading.
export function named(
  names: string[],
  found: Awaited<ReturnType<typeof loadPlugins>>,
): { plugins: Loaded[]; problems: string[] } {
  const plugins = found.plugins.filter((l) => names.includes(l.plugin.name))
  const problems = found.failed
    .filter((f) => names.includes(basename(f.folder)))
    .map((f) => `The plugin in ${f.folder} did not load: ${f.why}`)
  for (const n of names)
    if (!plugins.some((l) => l.plugin.name === n) && !problems.some((p) => p.includes(`/${n}`)))
      problems.push(`There is no plugin called ${n} in plugins/ to switch on.`)
  return { plugins, problems }
}
