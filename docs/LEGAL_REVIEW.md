# Terms and Privacy — points for counsel

The Terms of Use and Privacy Policy (`src/content/legal.ts`, last updated 14 July 2026) are good-faith drafts that describe only the Marketplace. By the founder's decision S4 (PLAN_SITE.md, 16 Sep 2026) they stay unchanged until counsel reviews them. The site has since added an investor waitlist and a platform prototype, and the business has moved to a P2P model. This list is what the drafts do not yet cover. The Portuguese versions are binding.

## Terms of Use

1. **What EmpowerFI is** (`legal.ts`, section "O que é a EmpowerFI"). It says EmpowerFI is a Marketplace, is not a financial institution and, at this stage, makes no credit operations and intermediates no payments. That still holds. It should also cover:
   - **The platform prototype at `/app`.** It runs a future regulated P2P productive-credit model on Solana devnet. Investments, returns, FX and Pix settlement there are simulated, and blockchain transactions use test assets. The disclaimer the site uses: *"Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet."*
   - **Demo accounts** with a public password, and no real persons' data in them.
   - **The P2P model as future architecture.** It will operate under the applicable regulated structure (such as a SEP, CMN Resolution 5.050), and EmpowerFI holds no such licence today.
   - **The planned pilot.** Its capital and credit decision come from a regulated financial partner, under that partner's licence and policy.
2. **No offer.** Nothing on the site or in the prototype is an offer of securities, of a financial product or of an investment. The investor waitlists (`/investors`, `/pt/investidores`) record a non-binding expression of interest.
3. **Pricing** (section "freemium"). It covers Marketplace plans only. Should it say that investing is not available through the site or the app?

## Privacy Policy

1. **Data collected and purposes.** Add:
   - **The investor waitlist:** e-mail, country, investor type (individual or institutional), pool of interest (domestic in reais, global in USDC, or both), indicative ticket and currency, motivation, consent to be contacted, language and source page. Its purpose is to contact the person about the pilot and the P2P model. The data is stored in the website's Supabase project (`investor_waitlist`), readable only by EmpowerFI.
   - **The platform prototype:**
     - demo accounts;
     - for a real person who signs in with a Solana wallet, the wallet address and the signed sign-in message;
     - business check-ins, readiness and eligibility assessments, consent choices, and simulated investments.
     - Today every prototype record is simulated, and no real entrepreneur's data is in it. Counsel should say whether the policy covers the prototype now or only once real people use it.
2. **Public blockchain.** The platform writes a SHA-256 commitment of each record to Solana, a public, permanent ledger. No personal data is written; the chain holds hashes, statuses and pseudonymous keys. Then:
   - **Personal data?** Does a hash of a record that includes personal data, keyed by a random reference, count as personal data under the LGPD?
   - **Deletion right** (section "Seus direitos"). A commitment cannot be erased. Deleting the database record leaves a hash that no longer points to anything readable. How should the policy say this?
   - **International transfer.** Solana validators are worldwide. The same question applies to the Zcash testnet treasury, which records only shielded transactions.
3. **Sharing.** The list names infrastructure, the e-mail provider, app stores and authorities. For the prototype and the future model, consider:
   - **Investors:** pseudonymous opportunity data only, with the entrepreneur's consent.
   - **EmpowerFI's P2P desk:** internal.
   - **The regulated partner** in the pilot.
   - **An off-ramp provider** (such as MoneyGram, sandbox only today: only an amount is sent).
   - **Price providers:** CoinGecko receives no personal data.
4. **Consent records.** In the platform, the entrepreneur's consent is by use: assessment, the P2P desk, investors, and impact figures. Each change is a new record, proven on Solana. The wording is versioned (`consent-v2`, English and Portuguese). Should the policy describe it, or refer to it?
5. **Where it is documented.** `docs/PRIVACY.md` describes what each role can see and what the chain can never see, and can be given to counsel as the technical basis.

## Also on the pages

- **Footer.** The legal pages use the institutional footer. It now carries the prototype disclaimer and the not-an-offer line, which counsel may want to review with the documents.
- **Last updated.** When the documents are revised, update `LAST_UPDATED_PT` and `LAST_UPDATED_EN`.
