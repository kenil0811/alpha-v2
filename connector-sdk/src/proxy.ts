// The way out of a connector's sandbox: its process reaches the hosts it
// may only through the sandbox's proxy, which web calls use by themselves. A library that dials
// out itself (mail by IMAP and SMTP, a database) is handed this; outside a sandbox, there is none.
export const proxy = (): string | undefined => process.env.HTTPS_PROXY || undefined
