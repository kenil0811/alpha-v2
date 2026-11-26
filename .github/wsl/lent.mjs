// Inside Alpha's Linux, as root: whether the computer the Bridge paired is there and online, and
// whether the file in the folder it lent has reached Alpha. Exits 1 if not.
import { readFileSync } from 'node:fs'
const token = readFileSync('/home/alpha/data/token', 'utf8').trim()
const get = (path) =>
  fetch(`http://127.0.0.1:4700${path}`, { headers: { 'x-alpha-token': token } }).then((r) => r.json())
let pcs = []
let files = []
for (let i = 0; i < 30; i++) {
  pcs = await get('/api/computers')
  files = await get('/api/files')
  if (Array.isArray(files) && files.some((f) => f.name === 'note.txt')) break
  await new Promise((r) => setTimeout(r, 2000))
}
const list = Array.isArray(pcs) ? pcs : (pcs.computers ?? [])
for (const c of list) console.log(`computer: ${c.name} (${c.online ? 'online' : 'offline'})`)
const got = Array.isArray(files) && files.some((f) => f.name === 'note.txt')
console.log(got ? 'the lent folder’s note.txt is in Alpha' : 'FAILED: note.txt did not reach Alpha')
process.exit(got ? 0 : 1)
