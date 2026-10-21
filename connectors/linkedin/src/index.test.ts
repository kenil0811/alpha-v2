// A LinkedIn connection read from its card's words, as its connections page shows them.
import { describe, expect, it } from 'vitest'
import { connectionOf, profileOf } from './index.ts'

describe('a LinkedIn card', () => {
  it('gives the name, headline, position, company and when they connected', () => {
    expect(
      connectionOf({
        href: 'https://www.linkedin.com/in/Sam-Ortiz-1a2b/',
        text: 'Sam Ortiz',
        card: 'Sam Ortiz\nSam Ortiz’s profile\nSenior Broker at Grand Business Brokers | ETA deals\nConnected on October 2, 2026\nMessage',
      }),
    ).toEqual({
      key: 'https://www.linkedin.com/in/sam-ortiz-1a2b/',
      values: {
        Name: 'Sam Ortiz',
        Profile: 'https://www.linkedin.com/in/sam-ortiz-1a2b/',
        Headline: 'Senior Broker at Grand Business Brokers | ETA deals',
        Position: 'Senior Broker',
        Company: 'Grand Business Brokers',
        'Connected on': '2026-10-02',
      },
    })
  })

  it('keeps a headline that names no company as it is, and refuses a link that is no profile', () => {
    expect(
      connectionOf({
        href: 'https://www.linkedin.com/in/ana/',
        text: '',
        card: 'Ana Ruiz\nHelping small firms grow\nConnected on 3 Jan 2025',
      })?.values,
    ).toEqual({
      Name: 'Ana Ruiz',
      Profile: 'https://www.linkedin.com/in/ana/',
      Headline: 'Helping small firms grow',
      'Connected on': '2025-01-03',
    })
    expect(profileOf('https://www.linkedin.com/company/acme/')).toBeNull()
  })
})
