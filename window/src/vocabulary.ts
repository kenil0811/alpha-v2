// The words a person reads in Alpha, agreed with Vikas (rulebook §2; "module everywhere", 23 Oct).
// The code keeps its own names (a kit, a company); the window never shows them. look.test.ts fails
// on any word on the left in what the window says.
export const NEVER_SAY: [RegExp, string][] = [
  [/\bkits?\b/i, 'module'],
  [/\bprojects?\b/i, 'module'],
  [/\bcompan(?:y|ies)\b/i, 'organization'],
  [/\bremember(?:ed|s)\b/i, 'Second Brain'],
  [/\bexport(?:ed|s)?\b/i, 'Download'],
  [/\bremov(?:e|es|ed|ing)\b/i, 'Delete'],
  [/\bnot now\b/i, 'Decline, or Cancel'],
  [/\bveto(?:es|ed)?\b/i, 'Decline'],
  [/\bcoming soon\b/i, 'the reason it can’t, on hover'],
  // the words any business app uses (Vikas, 28 Oct): one term for one thing, everywhere
  [/\bmaybe the same\b|\bmay be the same\b/i, 'Possible duplicate'],
  [/\bkeep apart\b/i, 'Not a duplicate'],
  [/\bwaits? (?:for|on) you\b|\bwaiting for your yes\b|\bwaits for your yes\b/i, 'Needs approval'],
  [/\bdidn[’']t finish\b/i, 'Failed'],
  [/\bshow original list\b/i, 'Clear filters'],
  [/\bbring back\b/i, 'Restore'],
  [/\blinked here\b/i, 'Related'],
  [/\bof\s+on\s*$/, 'active'],
]

// A card's plain answers, as the person reads them: a yes is Approve, a no is Decline.
export function answerWords(option: string): string {
  return option === 'Yes' ? 'Approve' : option === 'No' ? 'Decline' : option
}

// One name for what waits on the person, on Home and in Tasks (Vikas, 30 Oct).
export const NEEDS_YOU = 'Needs you'
