# Idea context — EmpowerFI

Productive credit infrastructure for women micro-entrepreneurs in Brazil: readiness and
eligibility engines, P2P funding with a regulated partner as lender of record, proofs
anchored on Solana, and private investing with shielded ZEC.

## landscape

Mapped 2 Oct 2026. Every figure read live rather than recalled.
Full report: https://claude.ai/artifact/AP2GgFt7xxZ5JLHFXpXZxM

```json
{
  "landscape": {
    "direct_competitors": [
      { "name": "Credix", "url": "https://credix.finance", "status": "pivot",
        "strength": "Alive, selling, Brazil-native, published client results; owned exactly this market on Solana",
        "weakness": "Removed the chain entirely — zero mentions of Solana, blockchain, crypto, USDC or token on its site today" },
      { "name": "Goldfinch", "url": "https://goldfinch.finance", "status": "live",
        "strength": "The original emerging-markets credit protocol, real originator network",
        "weakness": "TVL $1.96M; Ethereum only; institutional tier, not micro" },
      { "name": "Huma", "url": "https://huma.finance", "status": "live",
        "strength": "$372.6M TVL on Solana, the largest credit-adjacent protocol there",
        "weakness": "PayFi — payment receivables, a different borrower with a payer behind them" },
      { "name": "Maple", "url": "https://maple.finance", "status": "live",
        "strength": "$3.0B TVL, Ethereum and Solana",
        "weakness": "Institutional crypto-native borrowers; no emerging-market retail credit" },
      { "name": "Untangled", "url": "https://untangled.finance", "status": "live",
        "strength": "Tokenized private credit aimed at emerging markets",
        "weakness": "$0.15M TVL; never reached scale" }
    ],
    "substitutes": [
      { "name": "CrediAmigo (Banco do Nordeste)", "approach": "State-backed oriented productive microcredit under the PNMPO framework, 2M+ active clients, credit agents who visit",
        "why_users_stay": "Free at the point of access, human agent, explicitly serves women including Bolsa Familia recipients; for most borrowers it is the only option they know" },
      { "name": "Brazilian SEP / SCD fintechs", "approach": "Licensed peer-to-peer and direct-credit companies under CMN resolution",
        "why_users_stay": "They are the regulated shape; they lend without proving impact or shielding the borrower's record" },
      { "name": "Embedded credit (Credix, Nexoos)", "approach": "B2B receivables and checkout financing for SMEs",
        "why_users_stay": "Different borrower, but competes for the same investor appetite and the same 'credit infrastructure for Brazil' narrative" }
    ],
    "dead_projects": [
      { "name": "Credix (protocol)", "why_failed": "Protocol TVL peaked at $5.0M in Jun 2022 and is $0.00M now; the company kept the credit business and dropped the chain — tokenized receivables was not the moat" },
      { "name": "Moeda Seeds", "why_failed": "Brazilian blockchain microfinance for women entrepreneurs; gone, domain now serves unrelated crypto-investing content" },
      { "name": "TrueFi, Atlendis, Centrifuge/Tinlake, Clearpool Lending", "why_failed": "The 2020-2022 uncollateralized cohort; 14 of 21 protocols in the category are now below $0.20M" }
    ],
    "crowdedness": "empty",
    "moat_type": "data advantage (verifiable impact record), with technical complexity (selective disclosure) as the near-term differentiator",
    "differentiation": "Put the chain in the evidence and privacy path, not the funding path. Credix proved the funding path survives without a chain. Nobody abandoned the privacy problem because nobody took it on: shielded ZEC in, viewing key out, batched credits so the transparent leg cannot reconstruct what the shielded leg hid."
  }
}
```

## Open

- Colosseum hackathon submissions not searched (needs a PAT). That is where to look
  for a team building this right now.
