// The payments still late or chased, against the latest bank statement filed on a Payments row.
export default async (alpha) => {
  const statements = (await alpha.documents.list()).filter((d) =>
    d.rows.some((r) => r.table === 'Payments'),
  )
  if (!statements.length)
    throw new Error(
      'No bank statement is filed on Payments yet: add this month’s statement to a payment row.',
    )
  const open = (await alpha.rows.list('Payments')).filter((p) =>
    ['Late', 'Chasing'].includes(p.values.State),
  )
  if (open.length)
    await alpha.tell(
      `${open.length} payment${open.length === 1 ? '' : 's'} to check against ${statements.at(-1).name}.`,
      {
        table: 'Payments',
        rows: open.map((p) => p.id),
      },
    )
  return { words: `${open.length} payments to check.` }
}
