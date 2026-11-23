// Set up Alpha, the first run told as a story (the 22 Nov onboarding redesign): which chapters a
// person's story has, from who they are and what this Alpha has, and where they stand in it. The
// core owns Welcome, Claude, Your workspace, Connect, Your people and Done (a member's Welcome,
// What's here, Connect your own and Done); a plugin adds its own after Connect or after Your
// people. Code paces it: every screen is drawn from state at once.
import type { PluginChapter } from '../plugins/plugins.ts'
import type { Progress } from '../world/story.ts'
import type { ChapterState, StoryView } from './story-types.ts'

export interface Chapter {
  key: string
  title: string
  plugin: PluginChapter | null // a plugin's chapter, its screen and act its own
}

export interface StoryHere {
  owner: boolean
  modelSet: boolean // Alpha reaches Claude: no Claude chapter, unless it was gone through
  people: boolean // people sign in to this Alpha, so the owner has someone to add
  plugins: PluginChapter[]
  progress: Progress
}

const core = (key: string, title: string): Chapter => ({ key, title, plugin: null })

export function chaptersOf(h: StoryHere): Chapter[] {
  const theirs = h.plugins.filter((c) => c.who === 'everyone' || h.owner)
  const after = (where: PluginChapter['after']) =>
    theirs
      .filter((c) => c.after === where)
      .map((c): Chapter => ({ key: c.key, title: c.title, plugin: c }))
  if (!h.owner)
    return [
      core('welcome', 'Welcome'),
      core('here', 'What’s here'),
      core('connect', 'Connect your own'),
      ...after('connect'),
      ...after('people'),
      core('done', 'Done'),
    ]
  return [
    core('welcome', 'Welcome'),
    // nothing else works without a model, so Claude comes second while none is set (call 7)
    ...(!h.modelSet || h.progress.chapters.claude ? [core('claude', 'Claude')] : []),
    core('workspace', 'Your workspace'),
    core('connect', 'Connect'),
    ...after('connect'),
    ...(h.people ? [core('people', 'Your people')] : []),
    ...after('people'),
    core('done', 'Done'),
  ]
}

// Where the person's story stands: each chapter's state, the one they are on, Home's row.
export function storyView(chapters: Chapter[], p: Progress): StoryView {
  const done = !!p.doneAt
  const at = done ? null : (chapters.find((c) => !p.chapters[c.key])?.key ?? 'done')
  const state = (key: string): ChapterState =>
    p.chapters[key] ?? (key === at ? 'now' : done ? 'done' : 'ahead')
  const through = chapters.filter((c) => p.chapters[c.key]).length
  const declined = !!p.declinedAt && !done
  return {
    chapters: chapters.map((c) => ({ key: c.key, title: c.title, state: state(c.key) })),
    at,
    done,
    declined,
    fresh: !done && !declined && through === 0,
    // one row, how far they got, until they finish or decline (call 5); no checklist
    row:
      done || declined
        ? null
        : p.again
          ? 'A few more questions from Alpha'
          : through >= chapters.length
            ? 'Finish setting up'
            : through
              ? `Carry on setting up: ${through} of ${chapters.length} done`
              : 'Carry on setting up',
  }
}
