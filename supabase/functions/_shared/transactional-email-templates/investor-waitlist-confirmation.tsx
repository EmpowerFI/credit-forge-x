/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

/**
 * Confirmation sent to someone who joined the investor waitlist on /investors.
 * It has to restate the disclosure shown on the page: joining is non-binding
 * interest, and nothing is being offered or collected. Signups from
 * /pt/investidores get investor-waitlist-confirmation-pt, which says the same
 * in Portuguese — change both together.
 */
const InvestorWaitlistConfirmation = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the {SITE_NAME} investor waitlist</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're on the list.</Heading>
        <Text style={text}>
          We'll keep you updated as {SITE_NAME} builds P2P productive credit for
          women-led businesses in Brazil, funded through two pools: Brazilian investors in
          reais, and international and impact investors in USDC on Solana. Whichever pool
          funds her, she receives and repays in reais, by Pix.
        </Text>
        <Text style={text}>
          You'll hear from us as the pilot runs — with a regulated financial partner's
          capital — and when there is news about the P2P model.
        </Text>
        <Text style={disclosure}>
          Nothing in this email is an offer of securities or of a financial product.
          Joining the waitlist is a non-binding expression of interest, and {SITE_NAME} is
          not accepting investor funds. The P2P model will operate under the applicable
          regulated structure; {SITE_NAME} holds no such licence today.
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
