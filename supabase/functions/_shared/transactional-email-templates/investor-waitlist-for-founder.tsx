/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

interface Props {
  email?: string
  country?: string
  investorType?: string
  pool?: string
  currency?: string
  ticketRange?: string
  motivation?: string
  language?: string
  walletAddress?: string
}

/**
 * Sent to the founder when someone joins the investor waitlist on /investors or
 * /pt/investidores. The values arrive already humanised by the site, in English
 * whichever page the signup came from — this template does no mapping of its own.
 */
const InvestorWaitlistForFounder = ({
  email,
  country,
  investorType,
  pool,
  currency,
  ticketRange,
  motivation,
  language,
  walletAddress,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New investor waitlist signup — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New investor waitlist signup</Heading>
        <Text style={text}>
          Someone joined the {SITE_NAME} investor waitlist. This is non-binding interest,
          not a commitment of funds.
        </Text>

        <Section style={card}>
          <Text style={label}>Email</Text>
          <Text style={value}>{email || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Country</Text>
          <Text style={value}>{country || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Investor type</Text>
          <Text style={value}>{investorType || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Pool</Text>
          <Text style={value}>{pool || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Potential amount</Text>
          <Text style={value}>
            {ticketRange || 'Not provided'}
            {currency ? ` (${currency})` : ''}
          </Text>

          <Hr style={divider} />

          <Text style={label}>Primary motivation</Text>
          <Text style={value}>{motivation || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Language</Text>
          <Text style={value}>{language || 'Not provided'}</Text>

          <Hr style={divider} />

          <Text style={label}>Wallet</Text>
          <Text style={{ ...value, wordBreak: 'break-all' as const }}>
            {walletAddress || 'Not provided (optional)'}
          </Text>
        </Section>

        <Text style={footer}>
          Sent automatically by the {SITE_NAME} website. The full list lives in the
          investor_waitlist table.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvestorWaitlistForFounder,
  subject: (data: Record<string, unknown>) =>
    `Investor waitlist signup${data?.pool ? ` — ${String(data.pool)}` : ''}${
      data?.country ? ` — ${String(data.country)}` : ''
    }`,
  to: 'daniele@empowerfi.io',
  displayName: 'Investor waitlist signup (for the founder)',
  previewData: {
    email: 'investor@example.com',
    country: 'Germany',
    investorType: 'Individual',
    pool: 'Global P2P (in USDC)',
    currency: 'USD',
    ticketRange: '$500+',
    motivation: 'Both',
    language: 'English',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const card = {
  border: '1px solid #ececec',
  borderRadius: '12px',
  padding: '20px 22px',
  marginBottom: '24px',
}
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'hsl(36, 75%, 40%)',
  fontWeight: 600 as const,
  margin: '0 0 4px',
}
const value = {
  fontSize: '15px',
  color: '#1a1a1a',
  lineHeight: '1.55',
  margin: '0 0 4px',
}
const divider = {
  border: 'none',
  borderTop: '1px solid #ececec',
  margin: '16px 0',
}
const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '24px 0 0',
}
