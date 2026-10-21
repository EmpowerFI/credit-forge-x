# Diário de lançamentos pelo WhatsApp

*Especificação para revisão: fundadora e conselheira de crédito. Versão de 14/10/2026.*

## Por que muda

O check-in quinzenal pede que ela lembre, de uma vez, o que vendeu e gastou em quinze dias. Ninguém lembra. O número que chega é uma estimativa, e uma estimativa não sustenta uma análise de crédito.

O novo desenho pede **o registro do dia, no próprio dia**. Com os lançamentos diários, a EmpowerFI monta um **DRE simples** de cada semana e de cada mês. É isso que dá base a uma análise de crédito barata. Para criar o hábito, há **marcos com recompensa**: uma semana preenchida, trinta dias, e assim por diante.

## 1. O lançamento

Cada lançamento é uma linha:

| campo | o que guarda |
|---|---|
| data do registro | quando ela mandou (automático) |
| data do fato | o dia da venda ou do gasto. Por padrão é hoje. Ela pode registrar **ontem**, mas não antes disso |
| evento | **venda** ou **gasto** |
| valor | em reais |
| forma de pagamento | pix, dinheiro, cartão de débito, cartão de crédito, **fiado** |
| prazo | **à vista** ou **a prazo**. Se for a prazo: quando vai receber (venda) ou quando vai pagar (gasto). Um gasto a prazo pode ser **parcelado**, em até 12 vezes: ela informa o número de parcelas e o vencimento da primeira |
| classificação | só para gastos. Veja a lista abaixo |

**Compra parcelada** (decisão da fundadora, 19/10/2026). "R$ 600 em 3x no cartão" é um lançamento só: a compra inteira entra no resultado no dia em que foi feita, e o "a pagar" segue as parcelas, uma por mês a partir do vencimento da primeira. Os centavos que não dividem certinho vão para a primeira parcela. No VER e no APAGAR, a compra aparece e é apagada inteira. Venda parcelada fica para depois.

**O prazo é o que transforma o diário num sinal de crédito.** Uma venda no cartão de crédito ou no fiado entra no resultado no dia da venda, mas o dinheiro só entra no caixa depois. Com a data prevista, sabemos quanto ela **tem a receber** e quanto **tem a pagar**. As duas coisas pesam numa análise de crédito.

Um mesmo dia pode ter vários lançamentos. Também vale mandar o **total do dia por forma de pagamento**, por exemplo "vendas no pix: R$ 230". Não exigimos venda por venda.

### Por áudio ou por escrito

Decisão da fundadora, 20/10/2026. Além do formulário, ela pode **mandar um áudio** ou **escrever do jeito dela** ("vendi 250 no pix e gastei 80 de embalagem no dinheiro"). Nada é gravado antes de ela confirmar.

1. **O áudio vira texto** na OpenAI (`gpt-4o-mini-transcribe`). Ela recebe de volta o que foi ouvido: *"🎙️ Ouvi: «…»"*. Assim, um erro de transcrição aparece antes de qualquer outra coisa.
2. **O Claude separa o texto em lançamentos.** Ele não escreve nenhum número: para cada valor, cita o trecho exato do que ela disse ("250", "duzentos e cinquenta"). Faz o mesmo com a data de pagamento ("dia 10") e com as parcelas ("3x"). O que ele escolhe é a classificação: venda ou gasto, forma de pagamento, categoria. Ela vê e confirma essa escolha.
3. **O código confere tudo**:
   - Um valor citado que não está no que ela disse é recusado. Um valor dito uma vez não pode virar dois lançamentos.
   - O próprio código lê cada valor, data e número de parcelas, inclusive por extenso. O modelo não faz conta nenhuma.
   - O que falta não é preenchido. Uma venda sem forma de pagamento fica de fora, e ela é avisada: *"Venda de R$ 300,00: faltou dizer como recebeu"*. O mesmo vale para a data de receber no cartão de crédito ou no fiado e para a data de pagar uma compra a prazo.
   - Se ela não disse o dia, uma mensagem antes do meio-dia vale para **ontem** e uma depois do meio-dia vale para **hoje**. O resumo diz qual dia foi usado e como mudar.
4. **Ela recebe o resumo formatado com dois botões**, **Confirmar** e **Corrigir**. Confirmar grava exatamente o que estava no resumo, pelo mesmo caminho do formulário: a mesma confirmação, a mesma sequência e as mesmas recompensas. Corrigir descarta tudo e sugere mandar de novo ou usar o formulário. Um resumo vale por 23 horas e só o mais recente pode ser confirmado.

**Privacidade.**
- O áudio nunca é guardado: passa pela memória até a transcrição e some.
- O texto fica guardado só até ela responder e, de qualquer forma, é apagado em até 23 horas.
- O registro fica marcado como vindo de um resumo confirmado. A evidência continua `SELF_DECLARED`, como no formulário.
- O texto de consentimento conta isso a ela antes do cadastro (versão `whatsapp-2026-11`).

**Limites.**
- No máximo 20 mensagens por dia por empreendedora vão para os serviços de IA.
- Áudio de até 2 MB, mais ou menos 15 minutos de mensagem de voz.
- Texto de até 1.000 caracteres.
- Só mensagens com algum número, em algarismos ou por extenso, vão para o Claude. "Obrigada!" continua sendo só uma conversa.

## 2. Classificações e onde cada uma entra

| classificação (como ela vê) | grupo no DRE |
|---|---|
| Mercadoria ou matéria-prima | custo da mercadoria vendida (CMV) |
| Embalagem | CMV |
| Aluguel, água, luz, internet, telefone | despesa operacional fixa |
| Transporte e entrega | despesa operacional variável |
| Taxa da maquininha | despesa operacional variável |
| Taxa de app ou marketplace | despesa operacional variável |
| Divulgação | despesa operacional |
| Ajudante ou funcionário | despesa com pessoal |
| **Retirada para casa (pró-labore)** | abaixo do resultado: retirada |
| **Equipamento** | **investimento, fora do resultado** |
| **Parcela de empréstimo ou dívida** | **financeiro, fora do resultado** |
| Outro gasto do negócio | despesa operacional |

O equipamento fica fora do resultado de propósito. Se uma máquina de R$ 1.500 entrasse como despesa, o mês da compra pareceria um prejuízo. O mesmo vale para a parcela de um empréstimo: o valor pago é dívida, não custo do negócio.

*Validado com a conselheira em 14/10/2026: a lista começa assim e evolui se for preciso.*

## 3. O DRE que sai do diário

Ele é calculado toda semana e todo mês, sempre pelo código e nunca pela IA:

```
  Vendas (receita bruta)
– CMV
= Resultado bruto
– Despesas operacionais e com pessoal
= Resultado do negócio
– Retiradas para casa
= O que sobrou no negócio

À parte: investimentos, parcelas de dívida,
         a receber (vendas a prazo) e a pagar (gastos a prazo)
```

Nas mensagens para ela, a palavra é **"resultado"**, nunca "lucro". A regra já existe e continua valendo.

**Para o motor de crédito, nada muda.** Ele continua recebendo um mês montado, só que agora montado a partir dos lançamentos e não de uma lembrança. O mês só conta para crédito se tiver **dias preenchidos suficientes**.

*Decisão (14/10/2026): o mínimo é **30 dias preenchidos**, contando os dias marcados "sem movimento". Falta definir como isso se aplica a meses mais curtos e à tolerância semanal (veja a seção 10).*

### A taxa da maquininha

**Ela declara a taxa como gasto.** Nós não calculamos por ela. O código faz uma **checagem de coerência**: se ela vendeu no cartão no período, a taxa declarada deve ficar dentro de uma faixa plausível sobre essas vendas. Se ficar fora da faixa, ou se não houver taxa nenhuma, nada é corrigido e ninguém é punido. A divergência entra como **inconsistência**, o mesmo sinal que o motor de prontidão já usa e que pesa na **confiança** mostrada para a análise e para os parceiros. A faixa é um parâmetro configurável, não um número fixo no código.

*Construído em 20/10/2026.* A faixa inicial é de **1% a 6%** das vendas no débito e no crédito, avaliada mês a mês. Para a checagem fazer sentido, a classificação de taxas foi separada em duas: **taxa da maquininha**, que entra na checagem, e **taxa de app ou marketplace** (iFood e parecidos cobram de 12% a 27%), que fica fora dela. Cada mês fechado guarda o resultado (`ok`, `missing`, `low`, `high` ou sem vendas no cartão), os valores e a faixa usada. O resultado aparece na credencial do Business Passport. Ele ainda não entra na nota de prontidão: o motor está congelado na versão atual e só passa a contar a checagem na próxima versão.

## 4. O dia sem movimento

Há um botão **"hoje não teve movimento"**. Ele conta como dia preenchido. Sem esse botão, quem não vendeu nada teria de escolher entre perder a sequência e inventar uma venda, e qualquer número inventado acaba na análise de crédito.

## 5. Sequência e marcos

- Um dia está **preenchido** quando tem pelo menos um lançamento ou foi marcado "sem movimento".
- Ela tem **1 dia de tolerância por semana**: faltar um dia não zera a sequência, faltar dois zera.
- Os marcos e as recompensas são **configuráveis pelo dashboard**, sem mexer em código.

**O programa inicial (decisão da fundadora, 14/10/2026):**

| marco | recompensa |
|---|---|
| semana 1 completa | perk EmpowerFI |
| semana 2 completa | perk EmpowerFI, de valor maior |
| semana 4 completa | perk EmpowerFI, de valor maior |
| 60 dias | benefício financeiro do parceiro: inicialmente, um **cartão de crédito** |

A lógica é criar a rotina primeiro e só depois falar de dinheiro. Os perks das duas primeiras semanas reforçam o hábito no momento em que ele é mais frágil. O benefício financeiro vem quando o hábito já se mantém sozinho. A pesquisa mais citada sobre formação de hábito (Lally et al., 2010) encontrou uma mediana de **66 dias** até um comportamento ficar automático, com grande variação entre pessoas. Os 60 dias estão nesse ponto.

**Nenhum crédito antes de 60 dias de diário.** São 60 dias registrados no total, contando os dias "sem movimento", e não 60 seguidos: a sequência é o que dá a recompensa, a trava pede o histórico. O banco recusa qualquer compartilhamento para oferta de crédito antes disso, tanto o automático quanto o proposto pela equipe. O cartão é oferta do parceiro: quem aprova, e com qual limite, é o parceiro. A EmpowerFI entrega o histórico dela, com o consentimento de compartilhamento, e nunca promete aprovação.

**As recompensas** são brindes e perks de marketing da EmpowerFI, ou benefícios de parceiros. Quando o benefício é do parceiro, um cartão de crédito por exemplo, **quem oferece e quem decide é o parceiro**. A EmpowerFI não concede crédito e não promete aprovação. A mensagem diz que o benefício é oferecido pelo parceiro. Antes de qualquer dado dela ir para um parceiro, ela recebe **exatamente o que vai**: para quem, para quê, os números de cada mês e por quantos dias. Só então responde **AUTORIZO** ou **NÃO**. Cada autorização vale para um parceiro e um prazo, e ela pode encerrar quando quiser escrevendo **AUTORIZAÇÕES** (veja `docs/PASSPORT.md`, passo 3).

**O que protege os números da recompensa:** a recompensa vale pela **regularidade** (ter preenchido), nunca pelos **valores** (ter vendido muito). Uma variação brusca nos números é sinalizada para revisão humana. Ela nunca é punida automaticamente.

## 6. As mensagens

| quando | o que diz | quem escreve |
|---|---|---|
| a cada lançamento | confirmação, uma frase de incentivo e o status: *"faltam 2 dias para a recompensa da semana"* | **texto fixo, sem IA**: chega na hora, não custa nada e nunca erra a conta |
| ao atingir um marco | a recompensa e como resgatar | texto fixo |
| fim de cada semana | a leitura da semana: resumo, até duas observações, uma ação prática. Chega logo depois da confirmação quando ela registra o domingo (normalmente na segunda de manhã) ou, se o domingo não vier, no próximo dia que ela registrar. Só para semanas com pelo menos 3 dias registrados. A comparação com a semana anterior só aparece se as duas tiverem pelo menos 6 dias registrados | **IA**, com as mesmas travas da leitura mensal |
| todo dia às **9h** | lembrete para registrar **o dia anterior**, se ela ainda não registrou. De manhã, porque à noite ela está cansada (decisão da fundadora, 15/10/2026). Botões: *Registrar ontem* (abre o formulário), *Não abri ontem*, *Abri e não vendi*. No máximo um por dia; um envio que falha não é repetido | template aprovado pela Meta (`lembrete_diario`, passo a passo em [`META-SETUP.pt-BR.md`](META-SETUP.pt-BR.md)) |

As travas da leitura com IA continuam as mesmas: a IA não inventa números, não fala de crédito nem de empréstimo, não vê nome nem telefone, e existe sempre uma leitura de reserva escrita sem IA.

## 7. Custo do WhatsApp

- **Respostas** depois que ela manda algo: **sem custo**, porque estão dentro da janela de 24h que ela abriu.
- **Lembrete diário:** é uma mensagem iniciada pela EmpowerFI, então é um template de utilidade, **cobrado por mensagem**. A referência de mercado para o Brasil é em torno de **US$ 0,008** por mensagem. Com 30 lembretes, dá uns **US$ 0,24 por empreendedora por mês**. *Confirmar na tabela oficial da Meta antes de fechar orçamento: a cobrança passou a poder ser em reais e as regras mudaram em 2026.*
- O lembrete só sai se ela ainda não preencheu o dia. Quem preenche cedo não gera custo.

## 8. Onde as recompensas são configuradas

Na tela **Rewards** do dashboard, visível só para quem é dono (owner):

1. **O rascunho fica na própria tela:** marcos, recompensas, parceiro e texto, com a prévia da mensagem que ela vai ler no WhatsApp. Nada é salvo antes de publicar.
2. **Publicar cria uma versão congelada** no banco de produção (`efylyaroluqatqmtuuml`), pela função `reward_programme_publish`, que só aceita admin da plataforma ou dono do dashboard. Uma versão publicada nunca é editada: a próxima publicação cria outra. O histórico de versões fica em produção, então o banco de backoffice não precisa guardar rascunho.
3. **O WhatsApp lê só a versão publicada mais recente.** A versão 1 já vem com o programa da seção 5 e títulos provisórios, para o diário ter metas desde o primeiro dia. Cada recompensa concedida registra qual versão do programa valia naquele dia.

## 9. O que se aproveita do que já foi construído

**Fica:** a conversa de entrada e o consentimento, a identificação protegida do telefone, a verificação de assinatura da Meta, a proteção contra mensagem repetida, a camada de leitura com IA (validador, leitura de reserva, registro de auditoria) e o cálculo de indicadores.

**Sai:** as quinzenas e seus tokens. Nada disso chegou a ser usado por ninguém, então não há dados a migrar.

## 10. Perguntas abertas para a conselheira

Respondidas em 14/10/2026: a lista de classificações fica como está e evolui se for preciso; registrar **ontem** basta; a taxa da maquininha é declarada por ela e checada por nós (seção 3).

Ainda em aberto:

0. **60 dias e o motor de prontidão.** Hoje o motor de prontidão da EmpowerFI exige **3 meses** de histórico. Aos 60 dias ela tem 2. Proposta: o cartão aos 60 dias é decisão do parceiro, a partir do histórico compartilhado, e a avaliação de prontidão da EmpowerFI continua exigindo 3 meses. A alternativa seria baixar o motor para 2 meses.

1. **Os 30 dias.** Um mês civil tem de 28 a 31 dias, e a tolerância permite faltar 1 dia por semana. Qual regra vale?
   - **(a)** o mês vale se não tiver falha além da tolerância: em fevereiro, por exemplo, 24 de 28 dias já bastam; ou
   - **(b)** a empreendedora precisa de **30 dias seguidos** de diário, contando a tolerância, antes que o primeiro mês conte para crédito. Daí em diante, cada mês vale pela regra (a).
