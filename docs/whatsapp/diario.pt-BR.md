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
| prazo | **à vista** ou **a prazo**. Se for a prazo: quando vai receber (venda) ou quando vai pagar (gasto) |
| classificação | só para gastos. Veja a lista abaixo |

**O prazo é o que transforma o diário num sinal de crédito.** Uma venda no cartão de crédito ou no fiado entra no resultado no dia da venda, mas o dinheiro só entra no caixa depois. Com a data prevista, sabemos quanto ela **tem a receber** e quanto **tem a pagar**. As duas coisas pesam numa análise de crédito.

Um mesmo dia pode ter vários lançamentos. Também vale mandar o **total do dia por forma de pagamento**, por exemplo "vendas no pix: R$ 230". Não exigimos venda por venda.

## 2. Classificações e onde cada uma entra

| classificação (como ela vê) | grupo no DRE |
|---|---|
| Mercadoria ou matéria-prima | custo da mercadoria vendida (CMV) |
| Embalagem | CMV |
| Aluguel, água, luz, internet, telefone | despesa operacional fixa |
| Transporte e entrega | despesa operacional variável |
| Taxas (maquininha, aplicativo, marketplace) | despesa operacional variável |
| Divulgação | despesa operacional |
| Ajudante ou funcionário | despesa com pessoal |
| **Retirada para casa (pró-labore)** | abaixo do resultado: retirada |
| **Equipamento** | **investimento, fora do resultado** |
| **Parcela de empréstimo ou dívida** | **financeiro, fora do resultado** |
| Outro gasto do negócio | despesa operacional |

O equipamento fica fora do resultado de propósito. Se uma máquina de R$ 1.500 entrasse como despesa, o mês da compra pareceria um prejuízo. O mesmo vale para a parcela de um empréstimo: o valor pago é dívida, não custo do negócio.

> **Para a conselheira:** esta lista e os grupos estão corretos para o público? Falta alguma classificação comum?

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

> **Para a conselheira:** quantos dias preenchidos fazem um mês valer? A proposta é **20 dias**, contando os dias marcados "sem movimento".

## 4. O dia sem movimento

Há um botão **"hoje não teve movimento"**. Ele conta como dia preenchido. Sem esse botão, quem não vendeu nada teria de escolher entre perder a sequência e inventar uma venda, e qualquer número inventado acaba na análise de crédito.

## 5. Sequência e marcos

- Um dia está **preenchido** quando tem pelo menos um lançamento ou foi marcado "sem movimento".
- Ela tem **1 dia de tolerância por semana**: faltar um dia não zera a sequência, faltar dois zera.
- Os marcos (7 dias, 30 dias, 60, 90…) e as recompensas são **configuráveis pelo dashboard**, sem mexer em código.

**As recompensas** são brindes e perks de marketing da EmpowerFI, ou benefícios de parceiros. Quando o benefício é do parceiro, um cartão de crédito por exemplo, **quem oferece e quem decide é o parceiro**. A EmpowerFI não concede crédito e não promete aprovação. A mensagem diz que o benefício é oferecido pelo parceiro. Antes de qualquer dado dela ir para um parceiro, ela precisa ter dado o **consentimento de compartilhamento**, que já existe no cadastro.

**O que protege os números da recompensa:** a recompensa vale pela **regularidade** (ter preenchido), nunca pelos **valores** (ter vendido muito). Uma variação brusca nos números é sinalizada para revisão humana. Ela nunca é punida automaticamente.

## 6. As mensagens

| quando | o que diz | quem escreve |
|---|---|---|
| a cada lançamento | confirmação, uma frase de incentivo e o status: *"faltam 2 dias para a recompensa da semana"* | **texto fixo, sem IA**: chega na hora, não custa nada e nunca erra a conta |
| ao atingir um marco | a recompensa e como resgatar | texto fixo |
| fim de cada semana | a leitura da semana: resumo, até duas observações, uma ação prática | **IA**, com as mesmas travas da leitura mensal |
| todo dia, no horário escolhido por ela | lembrete, se ela ainda não preencheu | template aprovado pela Meta |

As travas da leitura com IA continuam as mesmas: a IA não inventa números, não fala de crédito nem de empréstimo, não vê nome nem telefone, e existe sempre uma leitura de reserva escrita sem IA.

## 7. Custo do WhatsApp

- **Respostas** depois que ela manda algo: **sem custo**, porque estão dentro da janela de 24h que ela abriu.
- **Lembrete diário:** é uma mensagem iniciada pela EmpowerFI, então é um template de utilidade, **cobrado por mensagem**. A referência de mercado para o Brasil é em torno de **US$ 0,008** por mensagem. Com 30 lembretes, dá uns **US$ 0,24 por empreendedora por mês**. *Confirmar na tabela oficial da Meta antes de fechar orçamento: a cobrança passou a poder ser em reais e as regras mudaram em 2026.*
- O lembrete só sai se ela ainda não preencheu o dia. Quem preenche cedo não gera custo.

## 8. Onde as recompensas são configuradas

O dashboard trabalha com dois bancos, e este desenho segue o padrão que ele já usa para alertas e preços:

1. **O programa de recompensas é editado no banco de backoffice** (`xifczvaiedmokdpjevsf`): marcos, recompensas, parceiro e texto da mensagem. Esse banco é a fonte de registro.
2. **Ao publicar**, uma função restrita a admin no banco de produção (`efylyaroluqatqmtuuml`) copia uma **versão congelada** do programa.
3. **O WhatsApp lê só a versão publicada em produção.** Uma mudança no rascunho não afeta ninguém até ser publicada. Cada recompensa concedida registra qual versão do programa valia naquele dia.

## 9. O que se aproveita do que já foi construído

**Fica:** a conversa de entrada e o consentimento, a identificação protegida do telefone, a verificação de assinatura da Meta, a proteção contra mensagem repetida, a camada de leitura com IA (validador, leitura de reserva, registro de auditoria) e o cálculo de indicadores.

**Sai:** as quinzenas e seus tokens. Nada disso chegou a ser usado por ninguém, então não há dados a migrar.

## 10. Perguntas abertas para a conselheira

1. A lista de classificações (seção 2) está completa e os grupos estão certos?
2. Quantos dias preenchidos fazem um mês valer para crédito (proposta: 20)?
3. Registrar **ontem** basta, ou ela precisa poder corrigir dias mais antigos?
4. A taxa da maquininha deve ser lançada por ela ou calculada por nós a partir das vendas no cartão?
