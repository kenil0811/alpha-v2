// Inside Alpha's Linux, as root: the servers' smoke test against a PC's Alpha. It answers, runs
// as a PC, serves the window, takes a made-up kit and runs its schedule in the sandbox; and the
// pairing link a Bridge on this PC would be given. Says each step; exits 1 on the first that fails.
import { readFileSync, writeFileSync } from 'node:fs'

const base = 'http://127.0.0.1:4700'
const token = readFileSync('/home/alpha/data/token', 'utf8').trim()
const call = async (path, body) => {
  const r = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-alpha-token': token, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { ok: r.ok, data: await r.json().catch(() => ({})) }
}
const fail = (why) => {
  console.log(`FAILED: ${why}`)
  process.exit(1)
}
const health = await call('/api/health')
if (!health.ok) fail('the core does not answer')
console.log(`answers: ${JSON.stringify(health.data)}`)
// a PC's: Claude's own sign-in from the window, not a server's pasted token
const model = await call('/api/model')
if (model.data.token !== null)
  fail('it runs as a server, not as a PC (a token box, not Claude’s sign-in)')
console.log('runs as a PC: Claude’s own sign-in, from the window')
const page = await fetch(`${base}/?t=${token}`).then((r) => r.text())
if (!page.includes('<div id="root">')) fail('the window is not served')
console.log('serves the window')
const kit = await call('/api/kits', { folder: '/opt/alpha/current/core/src/modules/test-kit' })
if (!kit.ok) fail(`the made-up kit did not install: ${JSON.stringify(kit.data)}`)
const view = await call(`/api/modules/${kit.data.module}`)
const counter = (view.data.schedules ?? []).find((s) => s.name === 'Counter')
if (!counter) fail('the made-up kit has no Counter schedule')
await call(`/api/schedules/${counter.id}/run`, {})
let ran = ''
for (let i = 0; i < 60 && !ran; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const runs = (await call('/api/activity')).data
  ran =
    (Array.isArray(runs) ? runs : []).find((r) => r.name === 'Counter' && r.state !== 'running')
      ?.state ?? ''
}
if (ran !== 'ok') fail(`the schedule did not run in the sandbox (${ran || 'no run'})`)
console.log('a schedule ran in the sandbox')
const link = await call('/api/computers/link', {})
if (!link.ok) fail('no pairing link')
// kept on Linux's disk: /tmp is emptied whenever Windows stops this Linux and it starts again
writeFileSync('/root/pair-link', link.data.link)
console.log(`a pairing link for this PC: ${String(link.data.link).replace(/pair=.*/, 'pair=…')}`)
