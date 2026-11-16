// Signing in as the person: the services a connector can sign in to with the client's own sign-in
// app. A provider says where the person signs in and where Alpha trades the answer for tokens, for
// the app the client's IT registered in their own tenant (or the firm registered with the service,
// as Intuit's are); what IT approves once, every connector's permissions within it; the setup sheet
// IT follows; and what its errors mean. No hosted service and no Alpha-wide app are in the path.
// The core keeps the tokens, and an app's secret, in the secret store; a connector only ever gets a
// short-lived token, from host.secret().

// The client's own sign-in app, as IT copies it from its page. Its secret, when it has one, is in
// the secret store, never here: `secret` only says one is kept.
export interface SignInApp {
  app: string // its id (Microsoft: the Application (client) ID; Intuit: the Client ID)
  directory?: string // the organisation it belongs to (Microsoft: the Directory (tenant) ID)
  secret?: boolean // its secret is kept (Intuit: the Client Secret)
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
  // the address's field that names the account to sign in as, when the provider takes one
  hint?: string
  // whether the sign-in proves itself with PKCE (an app with no secret must)
  pkce: boolean
  // how the app's secret goes with each token call: none for an app that has none, or as the
  // address's basic credentials (Intuit)
  secretIn?: 'basic'
  // where the person signed in to, as the answer names it on the address (Intuit: the company it
  // picked, realmId); kept on the connection, and the connection's from then on
  place?: { param: string; what: string }
  // the address the app registers keeps its port (Intuit matches it exactly; Microsoft takes any
  // port on this computer's own address)
  exactAddress?: boolean
  fields: { app: SignInField; directory?: SignInField; secret?: SignInField }
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
    `https://login.microsoftonline.com/${encodeURIComponent(a.directory ?? '')}/oauth2/v2.0/authorize`,
  token: (a) =>
    `https://login.microsoftonline.com/${encodeURIComponent(a.directory ?? '')}/oauth2/v2.0/token`,
  ask: { prompt: 'select_account', response_mode: 'query' },
  hint: 'login_hint',
  pkce: true,
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
  // read, drafts and send, approved once, though a connector asks only for what it uses
  scopes: [
    'User.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'Calendars.Read',
    'Contacts.Read',
  ],
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
        'Open "API permissions", choose "Add a permission", then "Microsoft Graph", then "Delegated permissions". Tick these seven, then choose "Add permissions".',
      copy: [
        'offline_access',
        'User.Read',
        'Mail.Read',
        'Mail.ReadWrite',
        'Mail.Send',
        'Calendars.Read',
        'Contacts.Read',
      ],
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

// Intuit, for QuickBooks: the firm's own app on Intuit's developer site, with its Client ID and
// Client Secret. Its test (development) keys reach Intuit's test companies only, and take
// http://localhost as the address to come back to; its production keys reach real companies and
// take an https address only (developer.intuit.com, read 15 Nov 2026). No PKCE: the secret proves
// the app. The answer names the company picked (realmId).
const INTUIT_KEY = /^[A-Za-z0-9]{20,80}$/

export const intuit: Provider = {
  name: 'intuit',
  title: 'Intuit',
  authorize: () => 'https://appcenter.intuit.com/connect/oauth2',
  token: () => 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  ask: {},
  pkce: false,
  secretIn: 'basic',
  place: { param: 'realmId', what: 'company' },
  exactAddress: true,
  fields: {
    app: { label: 'Client ID', pattern: INTUIT_KEY, example: 'ABxYz12…' },
    secret: { label: 'Client Secret', pattern: INTUIT_KEY, example: 'kept, never shown again' },
  },
  // QuickBooks Online's accounting data: Intuit has no narrower permission, so reading only is
  // the connector's own wall
  scopes: ['com.intuit.quickbooks.accounting'],
  always: [],
  console: 'https://developer.intuit.com/app/developer/dashboard',
  sheet: (back) => [
    {
      words:
        'Sign in to the Intuit Developer site and open your app, or create one: Create an app, then QuickBooks Online and Payments, with the Accounting scope.',
      copy: ['https://developer.intuit.com/app/developer/dashboard'],
    },
    {
      words:
        'Under Keys and credentials, Development keys reach Intuit’s test companies only, and Production keys reach real ones, once Intuit has approved the app. Copy the Client ID and Client Secret of the ones you use into the fields below.',
    },
    {
      words: back.startsWith('http://')
        ? 'Under Redirect URIs for Development, add this address exactly. Intuit takes an address like this one for its test companies only: real companies connect where Alpha has an https address.'
        : 'Under Redirect URIs, add this address exactly, for the keys you use.',
      copy: [back],
    },
    {
      words:
        'That is all. Each client company is a connection of its own, signed in once by that company’s admin, or by your firm’s owner for a client of your firm.',
    },
  ],
  explain: (e) => {
    const said = `${e.error} ${e.description}`.toLowerCase()
    if (e.error === 'invalid_client')
      return {
        kind: 'app',
        words:
          'Intuit does not take these keys: check the Client ID and Client Secret in Sign-in apps, and that they are the keys whose Redirect URIs hold Alpha’s address.',
      }
    if (said.includes('redirect'))
      return {
        kind: 'app',
        words:
          'Alpha’s address is not among the app’s Redirect URIs on the Intuit Developer site: add it exactly as Sign-in apps shows it.',
      }
    if (e.error === 'access_denied')
      return { kind: 'sign_in', words: 'You said no on Intuit’s page, so Alpha is not connected.' }
    return {
      kind: 'sign_in',
      words: `Intuit asks you to sign in again: ${firstSentence(e.description) || e.error}`,
    }
  },
}

// Google, for Calendar and Contacts: an app in the firm's (or, while testing, Kenil's) own Google
// Cloud project, a web client with its Client ID and Client secret. Published unverified, Google
// shows its warning and lets up to 100 people sign in; left in Testing, it ends each sign-in after
// 7 days. Offline access and the consent screen every time, so Google gives the long-lived token.
const GOOGLE_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/
const GOOGLE_SECRET = /^[A-Za-z0-9_-]{20,80}$/
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
] as const

export const google: Provider = {
  name: 'google',
  title: 'Google',
  authorize: () => 'https://accounts.google.com/o/oauth2/v2/auth',
  token: () => 'https://oauth2.googleapis.com/token',
  ask: { access_type: 'offline', prompt: 'consent' },
  hint: 'login_hint',
  pkce: true,
  secretIn: 'basic',
  fields: {
    app: {
      label: 'Client ID',
      pattern: GOOGLE_ID,
      example: '1234567890-abc123.apps.googleusercontent.com',
    },
    secret: { label: 'Client secret', pattern: GOOGLE_SECRET, example: 'kept, never shown again' },
  },
  scopes: ['openid', 'email', ...GOOGLE_SCOPES],
  always: [],
  console: 'https://console.cloud.google.com',
  sheet: (back) => [
    {
      words:
        'Open the Google Cloud console with the Google account that will own the app. In the project picker at the top, choose New project, name it Alpha, and open it.',
      copy: ['https://console.cloud.google.com'],
    },
    {
      words:
        'In APIs & Services › Library, find and enable the Google Calendar API, then the People API.',
    },
    {
      words:
        'In Google Auth Platform, under Branding, name the app Alpha and give your email. Under Audience choose External, then Publish app: it stays unverified, so Google warns each person once, and up to 100 people can sign in.',
    },
    {
      words: 'Under Data Access, choose Add or remove scopes and add these two, then Save.',
      copy: [...GOOGLE_SCOPES],
    },
    {
      words:
        'Under Clients, choose Create client, then Web application, named Alpha. Under Authorized redirect URIs, add this address exactly, then Create.',
      copy: [back],
    },
    {
      words: 'Copy the Client ID and the Client secret it shows into the fields below.',
    },
  ],
  explain: (e) => {
    const said = `${e.error} ${e.description}`.toLowerCase()
    if (e.error === 'invalid_client' || e.error === 'unauthorized_client')
      return {
        kind: 'app',
        words:
          'Google does not take this app: check the Client ID and Client secret in Sign-in apps.',
      }
    if (said.includes('redirect_uri'))
      return {
        kind: 'app',
        words:
          'Alpha’s address is not among the app’s Authorized redirect URIs in Google Cloud: add it exactly as Sign-in apps shows it.',
      }
    if (e.error === 'access_denied')
      return { kind: 'sign_in', words: 'You said no on Google’s page, so Alpha is not connected.' }
    return {
      kind: 'sign_in',
      words: `Google asks you to sign in again: ${firstSentence(e.description) || e.error}`,
    }
  },
}

export const PROVIDERS: Record<string, Provider> = { microsoft, intuit, google }
