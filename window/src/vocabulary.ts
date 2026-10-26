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
]

// A card's plain answers, as the person reads them: a yes is Approve, a no is Decline.
export function answerWords(option: string): string {
  return option === 'Yes' ? 'Approve' : option === 'No' ? 'Decline' : option
}
