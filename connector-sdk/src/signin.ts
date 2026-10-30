// Signing in as the person (step 2, part 5, Kenil's yes 30 Oct): the services a connector can sign
// in to with the client's own sign-in app. A provider says where the person signs in and where
// Alpha trades the answer for tokens, for the app the client's IT registered in their own tenant;
// what IT approves once, every connector's permissions within it; the setup sheet IT follows; and
// what its errors mean. No hosted service and no Alpha-wide app are in the path (Kenil, 25 Oct).
// The core keeps the tokens; a connector only ever gets a short-lived one, from host.secret().

// The client's own sign-in app, as IT copies it from its page.
export interface SignInApp {
  app: string // its id (Microsoft: the Application (client) ID)
  directory: string // the organisation it belongs to (Microsoft: the Directory (tenant) ID)
}

export interface SignInField {
  label: string
  pattern: RegExp
  example: string
}

// One step of the setup sheet: what IT does, and the values they copy exactly.
export interface SheetStep {
  words: string
  copy?: string[]
}

// What a provider's error means for the connection: IT has to approve the app first (waiting for
// the customer), the person signs in again, or the sign-in app itself is set up wrongly.
export interface Explained {
  kind: 'waiting' | 'sign_in' | 'app'
  words: string
}

export interface ProviderError {
  error: string // invalid_grant, access_denied, …
  description: string
  codes: number[]
}

export interface Provider {
  name: string // microsoft
  title: string // Microsoft
  authorize(app: SignInApp): string
  token(app: SignInApp): string
  // more on the sign-in page's address: the account picker, so the right account signs in
  ask: Record<string, string>
  fields: { app: SignInField; directory: SignInField }
  // what IT approves at once; a connector asks for some of these, never more
  scopes: readonly string[]
  // asked with every sign-in, for the long-lived token Alpha keeps
  always: readonly string[]
  // where IT manages the app
  console: string
  sheet(back: string, organisation: string): SheetStep[]
  explain(e: ProviderError): Explained
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i

// A provider's own words, cut where its codes and trace lines begin.
export function firstSentence(description: string): string {
  const plain = description
    .replace(/^AADSTS\d+:\s*/, '')
    .split(/\r?\n|Trace ID:/)[0]
    ?.trim()
  const m = /^(.*?[.!?])(\s|$)/.exec(plain ?? '')
  return (m?.[1] ?? plain ?? '').trim()
}

// The codes a description carries (AADSTS65001), for an answer that came back on the address.
export function codesIn(description: string): number[] {
  return [...description.matchAll(/AADSTS(\d+)/g)].map((m) => Number(m[1]))
}

export const microsoft: Provider = {
  name: 'microsoft',
  title: 'Microsoft',
  authorize: (a) =>
    `https://login.microsoftonline.com/${encodeURIComponent(a.directory)}/oauth2/v2.0/authorize`,
  token: (a) =>
    `https://login.microsoftonline.com/${encodeURIComponent(a.directory)}/oauth2/v2.0/token`,
  ask: { prompt: 'select_account' },
  fields: {
    app: {
      label: 'Application (client) ID',
      pattern: GUID,
      example: '1a2b3c4d-1111-2222-3333-444455556666',
    },
    directory: {
      label: 'Directory (tenant) ID',
      pattern: new RegExp(`${GUID.source}|${DOMAIN.source}`, 'i'),
      example: '9f8e7d6c-1111-2222-3333-444455556666',
    },
  },
  // read, drafts and send, approved once (Kenil, 30 Oct), though a connector asks only for what
  // it uses
  scopes: ['User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'],
  always: ['offline_access'],
  console: 'https://entra.microsoft.com',
  sheet: (back, organisation) => [
    {
      words:
        'Open the Microsoft Entra admin center as an admin of your organisation. Search for "App registrations" at the top, open it, and choose New registration.',
      copy: ['https://entra.microsoft.com'],
    },
    {
      words:
        'Name it Alpha. Under "Supported account types", choose "Accounts in this organizational directory only".',
      copy: ['Alpha'],
    },
    {
      words:
        'Under "Redirect URI", choose "Public client/native (mobile & desktop)" and enter this address exactly. Then choose Register.',
      copy: [back],
    },
    {
      words:
        'The app’s Overview shows its "Application (client) ID" and "Directory (tenant) ID". Copy both into the fields below.',
    },
    {
      words:
        'Open "API permissions", choose "Add a permission", then "Microsoft Graph", then "Delegated permissions". Tick these five, then choose "Add permissions".',
      copy: ['offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'],
    },
    {
      words: `Choose "Grant admin consent for ${organisation}" and confirm. Without this, each person approves Alpha for themselves when they sign in, if your organisation allows that.`,
    },
    {
      words:
        'That is all: no client secret is needed. Each person signs in with their own Microsoft account, and can only reach their own mail.',
    },
  ],
  explain: (e) => {
    const has = (...codes: number[]) => codes.some((c) => e.codes.includes(c))
    if (has(65001, 90094, 90095, 90099))
      return {
        kind: 'waiting',
        words:
          'Your IT has to approve Alpha for your organisation: the setup sheet’s step "Grant admin consent".',
      }
    if (has(65004) || e.error === 'access_denied')
      return {
        kind: 'sign_in',
        words: 'You said no on Microsoft’s page, so Alpha is not signed in.',
      }
    if (has(700016, 90002, 900023))
      return {
        kind: 'app',
        words:
          'Microsoft does not know this sign-in app: check its Application ID and Directory ID in Sign-in apps.',
      }
    if (has(50011, 500113))
      return {
        kind: 'app',
        words:
          'The sign-in app’s Redirect URI is not the address in the setup sheet: add it under Authentication › Mobile and desktop applications.',
      }
    if (has(7000218, 700025, 700054))
      return {
        kind: 'app',
        words:
          'The sign-in app is set up as a web app: its address belongs under Authentication › Mobile and desktop applications, with no client secret.',
      }
    return {
      kind: 'sign_in',
      words: `Microsoft asks you to sign in again: ${firstSentence(e.description) || e.error}`,
    }
  },
}

export const PROVIDERS: Record<string, Provider> = { microsoft }
