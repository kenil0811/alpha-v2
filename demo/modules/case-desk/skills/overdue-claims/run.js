// Open claims past their due date, told on Home with the rows they rest on.
export default async (alpha) => {
  const today = new Date().toISOString().slice(0, 10)
  const late = (await alpha.rows.list('Claims')).filter(
    (c) => c.values.Due && c.values.Due < today && c.values.Stage !== 'Decided',
  )
  if (late.length)
    await alpha.tell(`${late.length} open claim${late.length === 1 ? ' is' : 's are'} past due.`, {
      table: 'Claims',
      rows: late.map((c) => c.id),
    })
  return { words: `${late.length} claims past due.` }
}
