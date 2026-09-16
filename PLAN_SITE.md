# The public site on the P2P North Star — positioning brief

**Why:** the app and docs moved to the P2P North Star on 16 Sep (PLAN_P2P.md). The site still tells the earlier story: a financial partner decides and lends, EmpowerFI "is not a peer-to-peer lender", P2P and stablecoins are a far-off step, and investors are pitched stablecoins alone. Decision D2 left the site for later; this is that rewrite.
**Work:** on `hackathon`; `main`, the website database and its Edge Functions only after the founder approves.
**Status, 16 Sep:** decisions S1–S4 taken; the rewrite is on `hackathon`, checked at 1440 and 390 px with no overflow and no console errors. Before `main`: the waitlist migration on the website database, then `send-transactional-email` redeployed, then the site.

## Decisions (founder, 16 Sep)

| # | Question | Decision | What it means for the copy |
|---|---|---|---|
| S1 | The first real pilot | **The partner lends in the pilot** | The first 5–10 operations are funded with a regulated financial partner's capital, under its licence and credit policy. P2P investors come in the next phase. The site shows P2P with two pools as where EmpowerFI is going, demonstrated in the devnet prototype — not as the pilot. |
| S2 | Brazilian investors | **A Portuguese page and a waitlist in reais** | New `/pt/investidores`, with a waitlist in reais and a choice of pool. `/investors` shows both pools, and its form offers the choice too. The waitlist table gets a small migration, shown to the founder before it is applied. |
| S3 | Revenue | **Cost to serve and B2B**; in the pilot, **service to the partner** (founder, 16 Sep) | In the pilot, the partner pays EmpowerFI for its service: preparing communities, qualifying requests, following repayment and measuring outcomes. In the P2P model, EmpowerFI is paid by the cost to serve built into the entrepreneur's all-in rate. In both, by Community Intelligence for programmes and communities. No investor fee is mentioned. |
| S4 | Legal pages | **Unchanged, with a list for counsel** | Terms and Privacy stay as they are. `docs/LEGAL_REVIEW.md` lists what counsel should add. The institutional footer those pages use gets the prototype disclaimer. |

## The story, in one breath

EmpowerFI is P2P productive credit for women micro-entrepreneurs in Brazil. Communities prepare their members; members report their months; a readiness engine tells each what is missing. A participant who is ready may choose to ask for capital; EmpowerFI qualifies the request, and it becomes a qualified opportunity. In the P2P model, two pools of investors fund those opportunities — Brazilian investors in reais, and international and impact investors in USDC on Solana — and a Capital Allocation Engine chooses the pool for each one. She receives and repays in reais, by Pix, either way. EmpowerFI's P2P desk formalises the loan at the engine's rate and services it. Every step is proven on Solana, with no personal data on chain.

## Phases — say which one a sentence is about

| Phase | What is true | Say | Never say |
|---|---|---|---|
| **Today** | The app runs the whole P2P model on Solana devnet as a prototype. Investments, returns, FX and Pix are simulated; blockchain transactions use test assets. The Marketplace app is live on Google Play. | "a working prototype on Solana devnet", "demonstrated", "simulated" | that anyone can invest now; returns; that the prototype moves real money |
| **Pilot** (next 12 months) | 5–10 first operations, then 30–50, with capital from a regulated financial partner, under its licence and its credit policy. EmpowerFI prepares communities, qualifies requests, follows repayment and measures outcomes. | "in the pilot, a regulated financial partner provides the capital and makes the credit decision" | that P2P investors fund the pilot |
| **P2P** (after the pilot validates) | Investors fund qualified opportunities through the two pools; the engine allocates; EmpowerFI's P2P desk formalises and services — under the applicable regulated structure, such as a SEP (CMN Resolution 5.050). | "the P2P model", "our North Star", "under the applicable regulated structure" | that EmpowerFI holds or has applied for a SEP licence; dates |

The pilot partner deciding and lending is a fact about the pilot. It must not read as the permanent model, and "EmpowerFI will never make the lending decision" or "we are not a peer-to-peer lender" must go.

## Canonical sentences

Use these where they fit, word for word or close to it, so every page says the same thing.

| Idea | English | Português |
|---|---|---|
| Positioning | P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana. | Crédito produtivo P2P para mulheres empreendedoras no Brasil, da prontidão ao capital, com cada etapa comprovada na Solana. |
| The two pools | Two pools of P2P capital: Brazilian investors in reais, and international and impact investors in USDC on Solana. | Dois pools de capital P2P: investidores brasileiros em reais, e investidores internacionais e de impacto em USDC na Solana. |
| Her side | She receives and repays in reais, by Pix, whichever pool funds her. | Ela recebe e paga em reais, por Pix, seja qual for o pool que a financia. |
| The engine | A Capital Allocation Engine chooses the pool for each opportunity: first whether a pool can take it (liquidity, risk appetite, ticket, mandate), then which costs her less. | Um Motor de Alocação de Capital escolhe o pool de cada oportunidade: primeiro se o pool pode recebê-la (liquidez, apetite a risco, ticket, mandato), depois qual custa menos para ela. |
| Why global capital | Global capital earns its place by the availability, mandate or economics it adds — not by being on a blockchain. | O capital global ganha seu lugar pela disponibilidade, pelo mandato ou pela economia que traz — não por estar em uma blockchain. |
| The desk | EmpowerFI's P2P desk formalises each funded loan at the engine's rate and services it. | A mesa P2P da EmpowerFI formaliza cada empréstimo captado à taxa do motor e acompanha os pagamentos. |
| Thesis invariants | Readiness is not eligibility, and eligibility is not funding. Being ready and not asking is a complete outcome. | Prontidão não é elegibilidade, e elegibilidade não é captação. Estar pronta e não pedir crédito é um resultado completo. |
| Proof | Every step is recorded in a database and proven on Solana, with no personal data on chain. | Cada etapa fica registrada em banco de dados e comprovada na Solana, sem nenhum dado pessoal na blockchain. |
| Revenue | In the pilot, EmpowerFI is paid by the partner for its service — preparing communities, qualifying requests, following repayment and measuring outcomes. In the P2P model, by the cost to serve built into each loan's rate. In both, by Community Intelligence for programmes and communities. | No piloto, a EmpowerFI é remunerada pelo parceiro pelo serviço — preparar comunidades, qualificar pedidos, acompanhar pagamentos e medir resultados. No modelo P2P, pelo custo de servir embutido na taxa de cada empréstimo. Nas duas fases, pela Inteligência Comunitária para programas e comunidades. |
| Regulation | The P2P model will operate under the applicable regulated structure; EmpowerFI holds no such licence today. | O modelo P2P vai operar sob a estrutura regulada aplicável; hoje a EmpowerFI não tem essa licença. |
| Disclaimer (exact) | Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet. | Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet. |
| Not an offer | Nothing on this site is an offer of securities or of a financial product. Joining a waitlist is a non-binding expression of interest. | Nada neste site é oferta de valores mobiliários ou de produto financeiro. Entrar na lista de espera é uma manifestação de interesse, sem compromisso. |

## Rules for every page

- **Keep what still holds:** the market evidence and its sources, cost to serve, the readiness engine, productive outcomes (observed, not caused), the Marketplace app, Sebrae, the team and advisors, the Vister testimonial, the design and components.
- **Remove the old claims:** partners as the permanent lender or decider, "not a peer-to-peer lender", P2P and stablecoins as a far-off or unoffered step, stablecoins as simply cheaper or as what makes small tickets viable, a cost-only choice of rail, Solana as the settlement layer of every loan (it is the proof layer for every loan, and the capital rail only for the global pool).
- **Numbers:** use only figures already sourced in `src/content/sources.ts`. "More than 7 million women entrepreneurs" (unsourced) becomes the sourced 9.96 million women-led businesses.
- **Investors:** no return figures, no yields, no dates for opening investment.
- **Both languages:** a claim changed in one language is changed in the other where both exist.
- **Voice:** the site's own, which is plain, concrete and without hype. The PT pages speak to the entrepreneur as "você".
- **The disclaimer:** the exact text on every footer, and near the top of both investor pages.

## Page by page

- **`/` (EN home):**
  - **Hero and diagram:** the positioning line. The diagram shows both pools feeding the engine and the desk, ending at her business by Pix, with Solana as the proof for every step.
  - **Solution:** add *Allocate* and *Fund* to Prepare, Originate, Service and Measure.
  - **How it works:** ends in qualified opportunity → pool → formalisation → Pix → repayment by Pix.
  - **Readiness:** readiness, eligibility and funding. The third judgement is the engine's allocation and the desk's formalisation; in the pilot, the partner's credit decision.
  - **Business model:** three layers. Community Intelligence (B2B), qualification and servicing (the pilot, with the partner's capital), and the P2P capital platform (North Star, demonstrated on devnet, under a future regulated structure). Revenue per S3.
  - **Capital rail:** two pools and the engine, and why global capital earns its place.
  - **Pilot:** the partner's capital per S1, P2P after, and investors among those invited to talk.
  - **For partners:** communities, the regulated financial partner for the pilot, domestic investors, global and impact investors.
  - **Traction:** add the working devnet prototype.
  - **Footer:** the exact disclaimer and the tagline.
- **`/investors` (EN):**
  - **Hero:** productive credit in reais or in USDC, not "put stablecoins to work".
  - **Thesis:** two pools, the engine, the desk, proofs, phases, and "not an offer".
  - **Metrics and waitlist:** metrics per pool; the waitlist with a pool choice. Link the devnet prototype.
- **`/pt/investidores` (new, PT):** the same substance for Brazilian investors, with the waitlist in reais and domestic P2P first. Linked from the PT navbar, footer and CTA; `hreflang` pairs with `/investors`; in the sitemap.
- **`/pt` (PT home):**
  - **How it works:** keep her voice, but the partner approves only in the pilot. After that, investors fund, and she receives and repays by Pix. Blockchain is only mentioned as proof.
  - **Check-ins and training:** say they help, instead of "sem curso, sem formulário".
  - **Crédito produtivo:** the pilot wording.
  - **Investor link:** a link to `/pt/investidores` in the navbar, the footer and the CTA.
- **`/about` and `/pt/sobre`:**
  - **Story and layers:** P2P replaces "originates for financial partners" and the stablecoin-rail claim; the five layers end in the P2P capital platform.
  - **Numbers:** sourced.
  - **FAQ:** add two questions, "Who funds the loans?" and "Can I invest today?".
  - **Media:** the Protagonismo Mulher panel is no longer "upcoming".
  - **Footer:** the institutional footer gets the disclaimer.
- **Meta:** `index.html` title, description and JSON-LD; `structuredData.ts`; page metas. The OG images carry Marketplace-era text baked in and need a new image from design, flagged, not redrawn.
- **`/sources`:** the regulation description covers P2P/SEP as future architecture; the licensed-partners caveat is reworded for the pilot.
- **Waitlist emails:** the confirmation no longer says "settled with stablecoins", and a Portuguese confirmation goes to Portuguese signups.
