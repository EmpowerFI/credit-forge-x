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

## Tokenized credit positions (added 22 Sep 2026)

The platform prototype now turns each funded investment into a **Token-2022 asset on Solana devnet**: one mint per investment, supply of one, zero decimals, and no metadata at all. The asset id `EF-CREDIT-####` lives only in EmpowerFI's database; on chain the position is its mint address and nothing else. The mint uses the `DefaultAccountState` extension set to *frozen*, so a token account for it cannot be used until EmpowerFI, which holds the freeze authority, thaws it. A holder signs her own transfers in her own wallet; EmpowerFI cannot move her asset, only decide which destinations exist. Today every position but one stands behind a simulated investment, and each is labelled as such.

**This is the part of the prototype most likely to be read as something it is not**, so the questions below matter more than the rest of this document.

1. **Is the token a security?** It represents an economic position in a single loan, is not divisible, is not offered to the public, has no price and cannot be traded on any venue. Counsel should say whether, under CVM Parecer de Orientação 40/2022 and the collective-investment-contract test, a future production version would be a *valor mobiliário*, and what changes the answer — pooling, tranching, fungibility, or a market of any kind. The prototype does none of those and the plan (`PLAN_TOKENIZATION.md`, §7) commits to not doing them.
2. **What legal instrument would make the token carry the credit right?** Today it carries none: the copy says so in both languages. In production the token would have to be tied to an instrument — assignment of credit (*cessão de crédito*, Civil Code art. 286 ff.), a book-entry note, or a structure under the applicable regulated model. Counsel should say which, and what the borrower's contract must say for an assignment to be valid and enforceable against her.
3. **Transfer under the SEP model.** If the production model is a SEP under CMN Resolution 5.050, counsel should say whether an investor's credit right may be transferred at all, to whom, with what disclosure, and whether EmpowerFI admitting destination wallets makes it an intermediary in that transfer.
4. **Secondary market.** Any venue where these positions could be bought and sold needs CVM authorization. The prototype has no exchange, order book, auction, bid, depth or price discovery, and the screen says so. Counsel should say what would cross the line — a list of holders willing to sell? a message between two holders? — so the product knows the boundary before it approaches it.
5. **The admitted-wallet list.** EmpowerFI decides which wallets may receive a position. Counsel should say what that makes EmpowerFI: a registrar, a transfer agent, a gatekeeper with a duty to the holders, or none of these — and what the list's criteria have to be to avoid arbitrary exclusion.
6. **Tax.** An assignment of a credit right has IOF, income-tax and, for institutional holders, accounting consequences. Out of scope for the prototype; needed before any real issuance.
7. **What may be said in public.** The hackathon demo and any recording of it show this feature. The fixed wording below is what the product says; counsel should confirm it is enough, and say what must be added.

### The fixed wording, as shipped

Shown on every screen where the asset appears (`src/app/lib/positions.ts`, both locales; the Portuguese is binding):

> *"Protótipo em Devnet de uma futura estrutura regulada de crédito tokenizado. O ativo não confere direito legal por si, o instrumento jurídico de produção e qualquer mercado secundário exigem validação com assessoria jurídica brasileira e as regras aplicáveis do BCB e da CVM, e transferibilidade não é liquidez."*

And, under the list of positions:

> *"Aqui não há bolsa, livro de ofertas, leilão nem pool, não há lance, profundidade ou formação de preço. A EmpowerFI não é mercado de valores mobiliários, bolsa, securitizadora nem mercado secundário autorizado, e deter este ativo não é titularidade legal de um recebível."*

The word *liquidez* is never used for these assets. A position is labelled **transferível** or **retida**, and wherever *transferível* appears it is followed by "não há comprador, nem preço, nem mercado".

### For the Privacy Policy

- **The wallet address is the owner.** Nothing on chain links it to a person, but a transfer publishes a permanent, public link between two addresses. If a holder's address is known to anyone off chain, her positions and their movements are visible to everyone. The policy should say this plainly rather than rely on "pseudonymous".
- **What the mint holds.** A supply of one, EmpowerFI's authority keys and the frozen-by-default flag. No name, no amount, no borrower, no community, no rate, no date — and not even the asset id, which stays in the database. `scripts/platform/scan-chain-pii.mts` checks the position mints along with the audit program's accounts.
- **Erasure.** A mint cannot be burned out of history. Closing a position removes it from the screens and stops it moving; the account and its transactions remain on devnet.

## Also on the pages

- **Footer.** The legal pages use the institutional footer. It now carries the prototype disclaimer and the not-an-offer line, which counsel may want to review with the documents.
- **Last updated.** When the documents are revised, update `LAST_UPDATED_PT` and `LAST_UPDATED_EN`.
