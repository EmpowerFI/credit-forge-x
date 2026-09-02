/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

/**
 * Confirmation sent to someone who joined the investor waitlist. It has to
 * restate the disclosure shown on the page: joining is non-binding interest,
 * and nothing is being offered or collected.
 */
const InvestorWaitlistConfirmation = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the {SITE_NAME} investor waitlist</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're on the list.</Heading>
        <Text style={text}>
          We'll keep you updated as we prepare the first {SITE_NAME} productive credit
          pilot — small-ticket credit for women-led microbusinesses in Brazil, settled with
          stablecoins.
        </Text>
        <Text style={text}>
          You'll hear from us when the pilot opens and when the first results are in.
        </Text>
        <Text style={disclosure}>
          Joining the waitlist represents non-binding interest only. {SITE_NAME} is not
          currently offering securities or investment products, and is not accepting
          investor funds.
        </Text>
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvestorWaitlistConfirmation,
  subject: "You're on the EmpowerFI investor waitlist",
  displayName: 'Investor waitlist confirmation',
  previewData: {},
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
  margin: '0 0 16px',
}
const disclosure = {
  fontSize: '12px',
  color: '#7a7c81',
  lineHeight: '1.6',
  backgroundColor: '#f7f6f4',
  borderRadius: '10px',
  padding: '14px 16px',
  margin: '24px 0 0',
}
const footer = {
  fontSize: '13px',
  color: '#999999',
  margin: '28px 0 0',
}
