// A made-up connector for the journey connector-reaches (step 2, part 1, slice 2): it names one
// host in reaches, the journey's made-up site, and reads that site by its name and by another it
// does not name. The runner says the site as {site}, by its other name as {other}, and its host
// as {host}.
const page = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    return r.ok ? (/<p>(.*?)<\/p>/.exec(await r.text())?.[1] ?? '') : 'refused'
  } catch {
    return 'refused'
  }
}

export const connector = {
  manifest: {
    name: 'reacher',
    title: 'Reacher',
    auth: 'path',
    account: { label: 'Folder' },
    pace: { perMinute: 600 },
    reaches: ['{host}'],
  },
  guide: '# Reacher\n\nReads a made-up site, for a journey.',
  module: 'Reacher',
  tables: [{ name: 'Reached', fields: [{ name: 'Answer', kind: 'text' }] }],
  tools: {},
  sync: async (c) => {
    const items = [
      { key: 'named', values: { Answer: await page('{site}/page.html') } },
      { key: 'unnamed', values: { Answer: await page('{other}/page.html') } },
    ]
    const landed = await c.host.land('Reached', items)
    return { rows: items.length, sawNew: landed.added > 0 }
  },
}
