// A module's folder is a git repository (design §10): every install, update and kept change is a
// commit, so a skill's or a schedule's versions can be read back. isomorphic-git, so a Mac needs
// no git of its own.
import fs from 'node:fs'
import git from 'isomorphic-git'

const AUTHOR = { name: 'Alpha', email: 'alpha@localhost' }

export async function commitAll(dir: string, message: string): Promise<string | null> {
  if (!fs.existsSync(`${dir}/.git`)) await git.init({ fs, dir, defaultBranch: 'main' })
  const matrix = await git.statusMatrix({ fs, dir })
  let changed = false
  for (const [filepath, head, workdir, stage] of matrix) {
    if (workdir === 0) {
      if (head === 1) {
        await git.remove({ fs, dir, filepath })
        changed = true
      }
    } else if (head !== workdir || workdir !== stage) {
      await git.add({ fs, dir, filepath })
      changed = true
    }
  }
  if (!changed) return null
  return git.commit({ fs, dir, message, author: AUTHOR })
}

export async function history(
  dir: string,
  depth = 20,
): Promise<{ id: string; message: string; at: string }[]> {
  if (!fs.existsSync(`${dir}/.git`)) return []
  const log = await git.log({ fs, dir, depth })
  return log.map((c) => ({
    id: c.oid,
    message: c.commit.message.trim(),
    at: new Date(c.commit.author.timestamp * 1000).toISOString(),
  }))
}

// A file as it was just before a commit; gone again if that commit made it.
export async function restoreFile(dir: string, commit: string, path: string): Promise<void> {
  const { commit: c } = await git.readCommit({ fs, dir, oid: commit })
  const parent = c.parent[0]
  const full = `${dir}/${path}`
  try {
    if (!parent) throw new Error('no parent')
    const { blob } = await git.readBlob({ fs, dir, oid: parent, filepath: path })
    fs.writeFileSync(full, Buffer.from(blob))
  } catch {
    fs.rmSync(full, { force: true })
  }
}
