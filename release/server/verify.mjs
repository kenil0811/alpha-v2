// Whether a release is the one Kenil signed: the file, its signature, and the public key this
// server was set up with, which an update never replaces.
import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [file, sig, key] = process.argv.slice(2)
const ok = verify(
  null,
  readFileSync(file),
  createPublicKey(readFileSync(key)),
  Buffer.from(readFileSync(sig, 'utf8').trim(), 'base64'),
)
if (!ok) {
  console.error('That release is not signed by Alpha’s key.')
  process.exit(1)
}
