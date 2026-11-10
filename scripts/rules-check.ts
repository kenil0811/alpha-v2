// A wall for the rules (docs/rules.md, R3): each rule says how it is held, a rule marked test or
// skip has its rule() in core/src/rules/, and one left for later or to review has none yet. The
// tests themselves, run by `pnpm test`, hold each rule to its mark.
import { checkRules } from '../core/src/rules/check.ts'

const { problems, summary } = checkRules()
if (problems.length) {
  console.error('docs/rules.md and the rule tests in core/src/rules/ disagree:')
  for (const p of problems) console.error(`- ${p}`)
  process.exit(1)
}
console.log(summary)
