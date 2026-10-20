// A made-up reader for the tests: opens a page and lands what it finds.
export default async function (alpha) {
  const page = await alpha.browser.extract(alpha.input.url ?? 'https://supplies.example/list', {
    list: '.item',
    fields: { name: { css: '.n' } },
  })
  const landed = await alpha.rows.land(
    'Suppliers',
    page.items.map((i) => ({ key: i._id, values: { Name: i.name }, url: i._url })),
  )
  if (landed.added) await alpha.tell(`${landed.added} new suppliers.`)
  return { words: `${page.items.length} seen, ${landed.added} new` }
}
