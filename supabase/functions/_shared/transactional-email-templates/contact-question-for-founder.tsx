/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

interface Props {
  name?: string
  email?: string
  message?: string
}

const ContactQuestionForFounder = ({ name, email, message }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova pergunta enviada pelo site da {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova pergunta pelo site</Heading>
        <Text style={text}>
          Você recebeu uma nova pergunta enviada pelo formulário do site da {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Text style={label}>De</Text>
          <Text style={value}>{name || 'Não informado'}</Text>

          <Hr style={divider} />

          <Text style={label}>E-mail para resposta</Text>
          <Text style={value}>{email || 'Não informado'}</Text>

          <Hr style={divider} />

          <Text style={label}>Mensagem</Text>
          <Text style={{ ...value, whiteSpace: 'pre-wrap' }}>
            {message || '(sem mensagem)'}
          </Text>
        </Section>

        <Text style={footer}>
          Mensagem enviada automaticamente pelo site da {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactQuestionForFounder,
  subject: (data: Record<string, unknown>) =>
    `Nova pergunta pelo site${data?.name ? ` — ${String(data.name)}` : ''}`,
  to: 'daniele@empowerfi.io',
  displayName: 'Pergunta do site (para a fundadora)',
  previewData: {
    name: 'Maria Silva',
    email: 'maria@example.com',
    message: 'Tenho interesse em conversar sobre a tese da EmpowerFI como investidora.',
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
  color: 'hsl(349, 55%, 48%)',
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
