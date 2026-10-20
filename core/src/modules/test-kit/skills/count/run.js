export default async function (alpha) {
  const rows = await alpha.rows.list('Orders')
  return { orders: rows.length }
}
