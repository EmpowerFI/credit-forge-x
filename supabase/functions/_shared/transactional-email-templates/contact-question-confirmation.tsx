/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

interface Props {
  name?: string
}

const ContactQuestionConfirmation = ({ name }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos sua mensagem — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Obrigada, ${name}!` : 'Obrigada pelo contato!'}
        </Heading>
        <Text style={text}>
          Recebemos sua mensagem e a fundadora vai responder pessoalmente em breve.
        </Text>
        <Text style={text}>
          A {SITE_NAME} está em fase de desenvolvimento — agradecemos seu interesse em acompanhar a jornada.
        </Text>
        <Text style={footer}>— Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactQuestionConfirmation,
  subject: 'Recebemos sua mensagem — EmpowerFI',
  displayName: 'Confirmação de pergunta enviada',
  previewData: { name: 'Maria' },
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
const footer = {
  fontSize: '13px',
  color: '#999999',
  margin: '28px 0 0',
}
