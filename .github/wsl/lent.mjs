// Inside Alpha's Linux, as root: whether the computer the Bridge paired is there and online, and
// whether the file in the folder it lent has reached Alpha; says how the folder's connection stands
// while it waits. Exits 1 if the file does not arrive within three minutes.
import { readFileSync } from 'node:fs'
const token = readFileSync('/home/alpha/data/token', 'utf8').trim()
const get = (path) =>
  fetch(`http://127.0.0.1:4700${path}`, { headers: { 'x-alpha-token': token } }).then((r) => r.json())
let got = false
for (let i = 0; i < 36 && !got; i++) {
  const files = await get('/api/files')
  got = Array.isArray(files) && files.some((f) => f.name === 'note.txt')
  if (got || i % 6 === 0) {
    const pcs = await get('/api/computers')
    const list = Array.isArray(pcs) ? pcs : (pcs.computers ?? [])
    for (const c of list) {
      const page = await get(`/api/computers/${c.id}`)
      const lends = (page.lends ?? page.connections ?? []).map(
        (k) => `${k.account ?? k.title}: ${k.state ?? ''} ${k.health ?? ''} read ${k.lastSyncAt ?? 'never'}`,
      )
      console.log(`${i * 5} s: ${c.name} ${c.online ? 'online' : 'offline'}; ${lends.join('; ') || 'lends nothing yet'}`)
    }
  }
  if (!got) await new Promise((r) => setTimeout(r, 5000))
}
console.log(got ? 'the lent folder’s note.txt is in Alpha' : 'FAILED: note.txt did not reach Alpha')
process.exit(got ? 0 : 1)
