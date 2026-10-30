// New leads with no first contact after two days.
export default async (alpha) => {
  const old = (await alpha.rows.list('Leads')).filter(
    (l) =>
      (l.values.Stage ?? 'New') === 'New' && Date.now() - Date.parse(l.values.Received) > 2 * 864e5,
  )
  if (old.length)
    await alpha.tell(
      `${old.length} new lead${old.length === 1 ? '' : 's'} waiting over two days for a first contact.`,
      {
        table: 'Leads',
        rows: old.map((l) => l.id),
      },
    )
  return { words: `${old.length} leads past the first-contact target.` }
}
