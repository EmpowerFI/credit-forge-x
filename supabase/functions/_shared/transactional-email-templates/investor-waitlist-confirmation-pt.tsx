/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EmpowerFI'

/**
 * Confirmação para quem entrou na lista de espera em /pt/investidores. Espelha
 * investor-waitlist-confirmation (em inglês) — mude as duas juntas. Tem de
 * repetir o aviso da página: entrar na lista é manifestação de interesse, sem
 * compromisso, e nada está sendo oferecido ou recebido.
 */
const InvestorWaitlistConfirmationPt = () => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você está na lista de espera de investidores da {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você está na lista.</Heading>
        <Text style={text}>
          Vamos manter você informado enquanto a {SITE_NAME} constrói crédito produtivo
          P2P para negócios de mulheres no Brasil, com dois pools: investidores brasileiros
          em reais, e investidores internacionais e de impacto em USDC na Solana. Seja qual
          for o pool que a financia, ela recebe e paga em reais, por Pix.
        </Text>
        <Text style={text}>
          Você vai ter notícias nossas conforme o piloto avança — com capital de uma
          instituição financeira parceira regulada — e quando houver novidades sobre o
          modelo P2P.
        </Text>
        <Text style={disclosure}>
          Nada neste e-mail é oferta de valores mobiliários ou de produto financeiro.
          Entrar na lista de espera é uma manifestação de interesse, sem compromisso, e a{' '}
          {SITE_NAME} não está recebendo recursos de investidores. O modelo P2P vai operar
          sob a estrutura regulada aplicável; hoje a {SITE_NAME} não tem essa licença.
        </Text>
        <Text style={footer}>— Equipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvestorWaitlistConfirmationPt,
  subject: 'Você está na lista de espera de investidores da EmpowerFI',
  displayName: 'Confirmação da lista de espera de investidores (PT)',
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
