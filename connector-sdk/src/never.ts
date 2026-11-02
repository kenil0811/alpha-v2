// The never-use list (onboarding design §5), one rule wherever something read may leave the
// computer: connectors filter with it, and plugins ask it through their host. It starts from the
// list shipped here and grows with every site, folder or word the person adds to a connection's.

// The list shipped with Alpha: health, banking and money, dating, adult, gambling, religion and
// politics. A word matches a whole part of a name ("bet" never matches "alphabet", "chase" never
// "purchase"); a stem matches inside one ("bankofamerica").
export const SHIPPED_NEVER = [
  // health
  'clinic',
  'doctor',
  'therapy',
  'webmd',
  'mayoclinic',
  'patient',
  'dental',
  'mental',
  'mychart',
  // banking and money
  'paypal',
  'venmo',
  'chase',
  'wellsfargo',
  'citi',
  'citibank',
  'amex',
  'americanexpress',
  'capitalone',
  'hsbc',
  'barclays',
  'revolut',
  'wise',
  'coinbase',
  'binance',
  'robinhood',
  'schwab',
  'fidelity',
  'vanguard',
  'etrade',
  'creditkarma',
  'loan',
  'loans',
  'zelle',
  // dating
  'tinder',
  'bumble',
  'hinge',
  'okcupid',
  'grindr',
  // adult
  'xxx',
  'onlyfans',
  'xvideos',
  'adult',
  // gambling
  'bet',
  'betting',
  'draftkings',
  'fanduel',
  'bet365',
  'lottery',
  // religion
  'church',
  'mosque',
  'synagogue',
  'temple',
  'bible',
  'quran',
  'religion',
  // politics
  'democrat',
  'democrats',
  'republican',
  'gop',
  'politics',
  'campaign',
  'vote',
]
const SHIPPED_STEMS = [
  'health',
  'hospital',
  'pharma',
  'medical',
  'bank',
  'mortgage',
  'dating',
  'porn',
  'casino',
  'poker',
]

// Whether a name (a site, a folder, an app, some words) is on the never-use list: the shipped one
// and the person's own (whole sites and folders, or words).
export function never(name: string, theirs: string[] = []): boolean {
  const n = name.toLowerCase()
  const parts = n.split(/[^a-z0-9]+/).filter(Boolean)
  // the person's own: a whole site or folder, or a word
  for (const w of theirs.map((x) => x.trim().toLowerCase()).filter(Boolean))
    if (n === w || n.endsWith(`.${w}`) || n.startsWith(`${w}/`) || parts.includes(w)) return true
  return (
    SHIPPED_NEVER.some((w) => parts.includes(w)) ||
    SHIPPED_STEMS.some((w) => parts.some((p) => p.includes(w)))
  )
}
