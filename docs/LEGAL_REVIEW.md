# Terms and Privacy — points for counsel

> **Out of the MVP's scope, by the founder's decision of 27 Sep 2026.** Nothing
> in this document is a blocker for the hackathon submission: no capital moves,
> no credit is granted, every provider and instrument is invented, and the
> prototype states that on every screen that shows a number. This file is kept
> as the standing list for the day something here runs in the real world — the
> questions do not expire, they are simply not due now. The one constraint that
> survives the decision is the one the network's own section already carries: it
> is a hackathon demonstration, and it is not to be presented as a live
> marketplace of capital until counsel has answered.


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

## The Capital Network (added 26 Sep 2026)

The platform prototype now answers a wider question than "which of our two pools funds this?". For a qualified opportunity, a **Capital Network** of registered instruments is matched against the need and produces a **Recommended Capital Plan**: one route, or several together, each with an amount, the reasons it was chosen, and what it still depends on. `PLAN_CAPITAL_NETWORK.md` is the build record; `platform/supabase/migrations/20261002000000_capital_network.sql` onward is the code.

**What it actually does, so the questions below are read against the facts:**

- **Seven instrument types exist** in the schema: regional credit product, microcredit, commercial credit, *productive exchange within a network*, sponsored capital, and the two P2P pools the prototype already had.
- **All four providers and all five seeded instruments are invented for the prototype** and carry `is_simulated`. No real institution is named. A real one would appear only after it agreed to, as with the advisory board.
- **Nothing is created downstream.** The routes that are not pools never produce an investment, never mint a position and never touch a loan. They produce a recommendation and a status. The two P2P routes behave exactly as before this feature existed.
- **`requires_partner_approval` is a column, not a label.** It defaults to true and is true for every partner route; the operator screen cannot change it, because a column-level grant withholds it. Only the two P2P routes, which EmpowerFI's own desk closes, are false.
- **`is_credit` is a column too**, and false for the productive-exchange route, whose `currency` is `unit` rather than `BRL`. The operator screen cannot change that, or the route's name, for the same reason.
- **Consent gates the run.** `public.run_capital_engine()` refuses an opportunity whose owner has not granted the `partner` consent scope, and refuses again the moment she withdraws it.
- **The engine is deterministic and versioned.** Each decision records the need it ran against, the engine version and the policy version of every instrument it evaluated, so a recommendation can be reproduced rather than asserted.
- **She does not see the registry.** Row-level security keeps every provider's policy away from her; she sees the routes recommended for her, their amounts, whether each is credit, and whether it still needs someone's approval.

### Questions for counsel

1. **Is presenting a ranked list of third-party credit products to a qualified business *correspondente bancário* activity, intermediation, or neither** under the current structure, where EmpowerFI takes no fee on any route, transmits no proposal, and the partner's own approval process is untouched? If the answer turns on the fee, say so: `commercial_model` is stored as metadata today and nothing acts on it, and it can stay that way.
2. **What wording keeps the productive-exchange route outside the definitions of credit, foreign exchange and payment arrangement?** The route is goods and services exchanged between members of a network, in that network's own unit of account, with nothing repaid. The schema refuses to call it credit and refuses to price it in reais. The shipped Portuguese is below; counsel should say whether it is enough, and what a *real* network of this kind would have to be — an association, a cooperative, a barter club under a specific arrangement — before it could appear here unsimulated.
3. **May a sponsored-capital route linked to a programme be shown beside credit routes** without the sponsor becoming a party to a credit offer, and without the programme's own rules turning into terms EmpowerFI is responsible for?
4. **What must a route card say so that a recommendation is not an offer, and is "Requer aprovação do parceiro" enough?** The cards also carry "Uma recomendação, não uma oferta" and, on the entrepreneur's own screen, "a EmpowerFI não empresta e não aprova crédito". Counsel should say which of these is load-bearing and what else must appear, in Portuguese, on the card itself rather than in a footnote.
5. **Do the `commercial_model` fields need per-partner validation before being stored at all**, even as metadata that nothing bills from? They record whether an arrangement would be a referral fee, a success fee, a platform fee or none.

Two further questions the build raised, which were not in the original list:

6. **The business-age proxy.** No incorporation date is recorded anywhere in this product, so "months of reported history" — the span of her own check-ins — stands in for the age of the business, and it is what closes a route's minimum-history requirement. The screens label it as a proxy. Counsel should say whether a refusal resting on a proxy needs to be disclosed differently, and whether the entrepreneur has a right to see and contest the figure. Every refusal is already shown to her with both sides of the comparison.
7. **The documents an operator states on her behalf.** Nothing in the product records which papers a business holds, so an operator states them when running the engine and the statement is kept with the decision. Counsel should say what that makes the operator's statement, and whether it must be confirmed by her before a refusal is recorded against it.

### The fixed wording, as shipped

On every route that is not a loan (`src/app/lib/capitalNetwork.ts`, both locales; the Portuguese is binding):

> *"Bens e serviços trocados entre membros de uma rede, na unidade de conta da própria rede. Não é crédito, não é moeda e não é dinheiro que ela paga de volta."*

On its card, as a marker rather than a sentence: **"Não é crédito"**. On every route whose owner still decides: **"Requer aprovação do parceiro"**.

On the plan itself:

> *"Uma recomendação, não uma oferta: o dono de cada rota ainda decide."*

On the entrepreneur's own screen:

> *"De onde pode vir o capital que você pediu. Cada uma ainda precisa ser combinada com quem a oferece — nada aqui está aprovado, e nada é dívida ainda."*
>
> *"Uma recomendação, não uma oferta: a EmpowerFI não empresta e não aprova crédito."*

And on the operator's screen, under "O que isto não faz":

> *"Não faz análise de crédito, não aprova e não promete crédito. Toda rota de parceiro carrega 'Requer aprovação do parceiro'. Não cobra taxa de parceiro. O modelo comercial de um provedor é registrado como metadado e nada age sobre ele. Não muda como funciona um empréstimo, um investimento, uma liquidação ou uma posição tokenizada."*

**Until counsel has answered questions 1, 2 and 4, the Capital Network should not be shown outside a hackathon demo**, and every provider in it must stay simulated.
