// What a journey is: its fixtures, the plugins its Alpha has on, and its steps, each the person's
// own action or the scheduler's, with the checks on the world after it (run.ts runs them).
import { z } from 'zod'
import { Check } from './checks.ts'
import { Interview, PluginPress } from './plugin-steps.ts'
import { Edit, Remove, Reset } from './window.ts'

export const Journey = z.object({
  name: z.string(),
  title: z.string(),
  why: z.string(),
  fixtures: z.string().optional(), // its own recorded answers, in journeys/fixtures/journeys/<name>
  // the plugins this Alpha has switched on, as its alpha.yaml names them (plugins: [interviews]);
  // none when it names none (rules P1)
  plugins: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      say: z.string().optional(),
      in: z.string().optional(), // say it in this module's Conversation
      to: z.string().optional(), // say it to this agent, in its own conversation
      named: z.array(z.string()).optional(), // the agents picked with @ in the message

      // the first waiting card answered; a schedule's draft can be sent with Always when offered; on
      // its own page, through the window's routes
      answer: z
        .object({
          choice: z.string(),
          always: z.boolean().optional(),
          on_page: z.boolean().optional(),
        })
        .optional(),
      // a folder of files given to Alpha, copied from the repository so the journey owns it
      folder: z.object({ from: z.string(), only: z.string().optional() }).optional(),
      // files dropped on a row in the window, as the person drops them (a client's exports)
      drop: z
        .object({
          from: z.string(),
          only: z.string().optional(),
          on: z.object({ table: z.string(), row: z.string() }),
        })
        .optional(),
      // an account connected on recorded answers (journeys/fixtures), never a real one
      connect: z.object({ connector: z.string(), account: z.string() }).optional(),
      // a made-up site served on this Mac from the repository; later steps say it as {site}. Named
      // again with a state, it serves that state's pages at the same address (site.ts)
      site: z.object({ from: z.string(), state: z.string().optional() }).optional(),
      // a made-up connector added from a folder, its {site}, {other} and {host} said as the site's
      // (by its name, by another, and its host), connected and read once
      connector: z.object({ from: z.string(), account: z.string() }).optional(),
      // the customer's own step done: a file of this name in the journey's own
      // folder ({tmp}, the account a made-up connector is connected to)
      customer_does: z.string().optional(),
      // Run now on an agent's schedule, as the person presses it: its first, or the one named
      run_now: z.object({ agent: z.string(), name: z.string().optional() }).optional(),
      // Try again on a connection waiting for the customer, by its connector
      try_again: z.string().optional(),
      // a table renamed as the person renames it, by double-clicking its name
      rename: z.object({ table: z.string(), to: z.string() }).optional(),
      // Read now, as the person presses it on a connection, by its connector
      read_now: z.string().optional(),
      // Ask before agents and scripts open a new website, in Permissions, through the window's route
      ask_before_sites: z.boolean().optional(),
      // the rule waiting on its Save card approved in Permissions, by its name, through the
      // window's routes
      approve_rule: z.string().optional(),
      // a kit installed from a folder, its schedules on when the journey says so (all, or those named)
      kit: z
        .object({
          from: z.string(),
          schedules: z.union([z.enum(['on', 'paused']), z.array(z.string())]).default('paused'),
          signed: z.boolean().optional(), // from a pack signed with a key the journey makes (M1)
          update: z.boolean().optional(), // a newer version of a kit already installed
        })
        .optional(),
      // a person's computer through a stand-in Bridge: lends a folder, a file put in it, away, back
      bridge: z
        .object({
          lend: z.string().optional(),
          put: z.object({ name: z.string(), text: z.string() }).optional(),
          away: z.boolean().optional(),
          back: z.boolean().optional(),
          pause: z.boolean().optional(), // paused by its person there, or resumed (false)
          calendar: z.boolean().optional(), // its Calendar lent, through a stand-in helper
          contacts: z.boolean().optional(), // its Contacts lent, through the same stand-in
          // its browsing history lent, through the Bridge's browsing reader on recorded answers
          browsing: z.boolean().optional(),
        })
        .optional(),
      // the scheduler's tick: schedules whose time or change has come run now, or so many days on
      due: z.union([z.boolean(), z.object({ days: z.number() })]).optional(),
      // a button on a plugin's screen pressed, or the screen read, through its own routes
      plugin: PluginPress.optional(),
      // an agent's cards answered one at a time as they come, as the person answers them
      interview: Interview.optional(),
      // every waiting card of a schedule's rows decided: each row not yet decided takes this choice
      review: z.object({ choice: z.string(), words: z.string().optional() }).optional(),
      // Revert from Activity, as the person: the newest run or turn that wrote rows, or revert
      revert: z.enum(['last_run', 'last_turn', 'last_revert']).optional(),
      // two people merged by the person, by their names, and one merged in let go
      merge: z.object({ keep: z.string(), other: z.string() }).optional(),
      unmerge: z.string().optional(),
      // a value typed over a row's, a row removed, Reset on a value: in the window (window.ts)
      edit: Edit.optional(),
      remove: Remove.optional(),
      reset: Reset.optional(),
      // a check that waits on what it names, as a rule of docs/rules.md does, passes while it
      // fails, and fails the day it holds, until its waits comes off
      checks: z
        .array(z.intersection(Check, z.object({ waits: z.string().min(1).optional() })))
        .default([]),
    }),
  ),
})
