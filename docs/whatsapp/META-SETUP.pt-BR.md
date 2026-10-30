# Ligar o WhatsApp: passo a passo na Meta

**Para:** a fundadora, que faz estes passos no painel da Meta e no do Supabase. O código já está pronto. Aqui estão só as configurações, na ordem certa.

Comece pelo **projeto dev** (`boivrcjvsnrmzbregavl`). Quando tudo funcionar, repita no **projeto prod** (`efylyaroluqatqmtuuml`).

Nenhuma chave, token ou segredo deste guia vai para o chat ou para o repositório. Cada um vai direto para o painel do Supabase, em **Edge Functions → Secrets**.

Os caminhos abaixo foram conferidos no painel da Meta entre 22 e 30/10/2026, com o painel em português. Se algum nome mudar, procure o equivalente.

> **O número de teste da Meta não serve para o Brasil.** Ele é americano (+1), e a Meta bloqueia mensagens de números estrangeiros para celulares +55 (erro 130497). Mensagens que chegam funcionam, mas as respostas não saem. O mesmo vale para a opção "Use a display name with a virtual number", que também dá um número +1. Para conversar de verdade, é preciso um **número brasileiro** só da EmpowerFI, fora do aplicativo do WhatsApp (passo 7).

## 0. Como a Meta organiza as contas (desde 23/09/2026)

A antiga "conta do WhatsApp Business" virou duas:

- **WhatsApp account:** guarda **um único número** e o perfil da empresa.
- **Messaging account** (conta de mensagens): guarda os **modelos de mensagem**, a **forma de pagamento** e as assinaturas do webhook. O ID antigo da conta do WhatsApp agora identifica esta conta.

Ficam em **business.facebook.com → Configurações → Contas → WhatsApp accounts / Messaging accounts**. A lista de WhatsApp accounts pode aparecer vazia: a Meta só mostra essas contas numa fase posterior da mudança.

Três coisas que aprendemos na prática:

1. **Conta do aplicativo não é conta da API.** Se a fundadora liga o aplicativo WhatsApp Business ao portfólio, aparece uma conta de mensagens marcada "Aplicativo WhatsApp Business". Ela **não tem modelos de mensagem** e o número dela **não serve para a API**. O registro desse número acompanha o aplicativo: trocar o número no aplicativo troca o registro junto.
2. **Para a API, o número tem que estar fora de qualquer aplicativo do WhatsApp.** Usar um número que está no aplicativo significa apagar a conta do aplicativo, o que apaga o histórico e cancela o Meta Verified, se houver. A outra opção, aplicativo e API no mesmo número ("coexistência"), só existe por um provedor parceiro, e faria o robô responder todo mundo que escreve para aquele número.
3. **O número da API é cadastrado pelo painel de desenvolvedor**, em **Casos de uso → Personalizar → Etapa 2 → Adicionar número de telefone**. Esse caminho cria as duas contas, já ligadas ao app.

---

## 1. O app e o número de teste

1. Abra https://developers.facebook.com/apps e entre no app **empowerfi**. O caso de uso "Conectar-se com os clientes pelo WhatsApp" já está configurado.
2. No menu da esquerda, clique em **Casos de uso**. No card do WhatsApp, clique em **Personalizar**. Confirme que está em **Integrar com API**.
3. Em **Configuração básica**, abra **Etapa 1. Experimente**. Ali estão:
   - o número de teste;
   - o **Phone Number ID**;
   - a **Identificação da conta de mensagens**;
   - um token temporário de 24 horas, que não usamos.

## 2. Os segredos no Supabase

No painel do Supabase, abra o projeto **dev** e depois **Edge Functions → Secrets**.

| nome | valor | onde está |
|---|---|---|
| `WHATSAPP_APP_SECRET` | a chave secreta do app | Meta: **Configurações do app → Básico → Chave Secreta do Aplicativo → Mostrar** |
| `WHATSAPP_VERIFY_TOKEN` | uma senha que você inventa: `openssl rand -hex 24` no terminal | vai de novo no passo 3 |
| `WHATSAPP_PHONE_NUMBER_ID` | o Phone Number ID | Meta: Etapa 1 (teste) ou Etapa 2 (número brasileiro) |
| `WHATSAPP_TOKEN` | o token permanente | passo 7 |

(`ANTHROPIC_API_KEY` e `OPENAI_API_KEY` já estão lá.)

## 3. O webhook: onde a Meta entrega as mensagens

1. Em **Casos de uso → Personalizar**, abra **Etapa 2. Configuração da produção → Configurar webhooks**.
2. Preencha:
   - **URL de callback:** `https://boivrcjvsnrmzbregavl.supabase.co/functions/v1/whatsapp-webhook`
   - **Verificar token:** a mesma senha de `WHATSAPP_VERIFY_TOKEN`
3. Deixe o certificado de cliente desligado e clique em **Verificar e salvar**. Se der certo, a Meta muda de tela sem mostrar erro.
4. Na lista de campos do webhook, confira que **messages** está **Assinado**.
5. Clique em **Teste** na linha *messages*. Depois, no Supabase, em **Edge Functions → whatsapp-webhook → Invocations**, deve aparecer um **POST 200**. Um **401** quer dizer que `WHATSAPP_APP_SECRET` não confere.

**Publicar o app.** Enquanto o app estiver "Não publicado", a Meta só manda ao webhook os testes do painel, não mensagens reais. Para publicar:
1. Em **Configurações do app → Básico**, preencha:
   - **URL da Política de Privacidade:** `https://www.empowerfi.io/privacidade`
   - **URL dos Termos de Serviço:** `https://www.empowerfi.io/termos`
   - **Categoria**.
2. Use **Publicar** no menu da esquerda.

## 4. O formulário do diário

1. Abra o **WhatsApp Manager** da conta de mensagens da API (passo 7; a do aplicativo não serve) → **Flows → Criar Flow**.
2. Preencha:
   - **Name:** `Registro do dia`
   - **Category:** *Other*
   - **Template:** *Default*, sem endpoint.
3. No editor, apague todo o JSON e cole o conteúdo do arquivo [`diario-flow.pt-BR.json`](diario-flow.pt-BR.json). No GitHub, use o botão **Raw** para copiar.
4. O painel da direita deve mostrar **nenhum erro**. Use **Preview** para conferir as quatro telas: vendas e até três gastos, com parcelas.
5. Clique em **Publish**. Um formulário publicado não pode mais ser editado; para mudar, a gente gera outro.
6. Copie o **Flow ID**, o número na página do formulário, e adicione no Supabase o segredo `WHATSAPP_JOURNAL_FLOW_ID`.

**Teste:** mande qualquer mensagem sem números, por exemplo "oi". O botão **Registrar o dia** deve chegar. Preencha e confira se chega o "Registrado ✅".

## 5. O modelo do lembrete das 9h

O lembrete é a única mensagem que a EmpowerFI manda sem ela ter escrito antes. Por isso precisa ser um **modelo aprovado pela Meta**, e cada envio é cobrado.

Os modelos ficam na **conta de mensagens da API**, a que o cadastro do número brasileiro cria (passo 7). A conta do aplicativo WhatsApp Business não tem modelos. Abra o **WhatsApp Manager** dessa conta → **Modelos de mensagem → Criar modelo** e preencha. Se a tela perguntar o tipo de variável, escolha **Número** (`{{1}}`), não **Nome**:

| campo | valor |
|---|---|
| Category | **Utility** |
| Name | `lembrete_diario` (exatamente assim) |
| Language | **Portuguese (BR)** |
| Body | `Bom dia, {{1}}! Ainda falta o registro de ontem. Toque em *Registrar ontem* para preencher, ou me conte por escrito ou por áudio o que vendeu e o que gastou.` |
| Sample para {{1}} | `Maria` |
| Footer | `Para parar os lembretes, responda SAIR.` |
| Buttons | **Quick reply**, três, **nesta ordem**: `Registrar ontem`, `Não abri ontem`, `Abri e não vendi` |

A ordem dos botões importa: o código sabe o que cada um faz pela posição. Envie para aprovação. Costuma levar de minutos a algumas horas.

Se a Meta pedir mudanças no texto, pode ajustar à vontade, desde que mantenha o `{{1}}` e os três botões na mesma ordem. Se o nome do modelo tiver que mudar, coloque o novo nome no segredo `WHATSAPP_REMINDER_TEMPLATE`.

### 5b. O modelo do aviso de pausa

Quem passa **7 dias seguidos sem registrar** recebe, no 7º dia, este aviso no lugar do lembrete. Depois disso, não recebe mais nada até registrar um dia ou mandar qualquer mensagem. Aí os lembretes voltam sozinhos (decisão da fundadora, 26/10/2026). Como ela não escreve há uma semana, a janela de 24 horas está fechada, e por isso o aviso também precisa ser um modelo aprovado.

| campo | valor |
|---|---|
| Category | **Utility** |
| Name | `lembrete_pausa` (exatamente assim) |
| Language | **Portuguese (BR)** |
| Body | `Oi, {{1}}! Faz uma semana que o seu dia não é registrado. Para não te incomodar, vou pausar os lembretes diários. Quando quiser voltar, toque no botão ou me mande qualquer mensagem: os lembretes voltam sozinhos.` |
| Sample para {{1}} | `Maria` |
| Footer | `Para parar de vez, responda SAIR.` |
| Buttons | **Quick reply**, um só: `Registrar ontem` |

A Meta pode reclassificar esse modelo como **Marketing**, porque ele convida a pessoa a voltar. Se isso acontecer, ele fica mais caro por envio, mas é uma mensagem só por pausa. Se o nome do modelo mudar, coloque o novo no segredo `WHATSAPP_PAUSE_TEMPLATE`.

## 6. O agendamento do lembrete

O banco chama a função `journal-reminder` todo dia às 9h, horário de Brasília. Para isso, ele precisa de um segredo compartilhado. No seu computador, na pasta do repositório, faça:

1. Gere o segredo:
   ```
   npx tsx scripts/whatsapp/generate-reminder-secret.mts ~/.config/empowerfi/journal-reminder-dev.env boivrcjvsnrmzbregavl
   ```
2. Coloque o segredo na função:
   ```
   npx supabase secrets set --env-file ~/.config/empowerfi/journal-reminder-dev.env --project-ref boivrcjvsnrmzbregavl --workdir platform
   ```
3. Abra o arquivo `~/.config/empowerfi/journal-reminder-dev-vault.sql`, copie as duas linhas `select` para o **SQL Editor** do projeto dev e rode.
4. Apague o arquivo `-vault.sql`.
5. Publique a função:
   ```
   npx supabase functions deploy journal-reminder --project-ref boivrcjvsnrmzbregavl --workdir platform
   ```

**Teste**, sem esperar até as 9h:
1. Escolha uma empreendedora de teste que se cadastrou antes de hoje e não registrou ontem.
2. No SQL Editor, rode `select private.dispatch_journal_reminder();`.
3. O lembrete deve chegar em alguns segundos. Toque em cada botão:
   - **Registrar ontem** abre o formulário;
   - **Não abri ontem** e **Abri e não vendi** registram o dia sem movimento.

## 7. O número brasileiro e o token permanente

**Antes de começar:**
- **Faça a verificação da empresa** (Etapa 3), com o cartão CNPJ e os dados do portfólio iguais aos do cartão: razão social, endereço, telefone e site. Sem ela, a Meta recusou o cadastro com "sua empresa não atende às exigências da política do WhatsApp" (#2494070).
- **Na categoria, use a que corresponde ao CNPJ** (consultoria ou tecnologia), e não "Finanças e bancos". Essa categoria leva a uma checagem mais rigorosa, e pelo WhatsApp a EmpowerFI oferece um diário, não crédito.
- **Cada recusa conta.** O portfólio tem um limite de contas do WhatsApp antes das verificações ("Você só pode criar um número limitado de contas…"), e um número que pede código muitas vezes fica bloqueado por 12 a 24 horas. Tente uma vez e, se der erro, pare.

**Os passos:**
1. Compre um chip só para a EmpowerFI. O número não pode estar no aplicativo do WhatsApp, nem no comum nem no Business.
2. Em **Etapa 2 → Adicionar número de telefone**, escolha **"Insira um novo número de telefone"**, preencha o nome de exibição ("EmpowerFI") e confirme com o código recebido por SMS ou ligação.
3. **Forma de pagamento:** fica na **conta de mensagens** do número, a que o passo 2 criou. As primeiras 1.000 respostas do mês são grátis; depois disso, cada mensagem da EmpowerFI é cobrada, o lembrete das 9h sempre.
4. **Token permanente:** é criado em **Configurações → Usuários → Usuários do sistema → Gerar novo token**, para o app empowerfi, com as permissões `business_management`, `whatsapp_business_management` e `whatsapp_business_messaging` e a validade **Nunca**. Ele vai direto para o segredo `WHATSAPP_TOKEN`; guarde uma cópia num gerenciador de senhas, porque o Supabase não mostra o valor de novo.
5. **Dê ao token acesso às contas novas:** no mesmo usuário do sistema, **Atribuir ativos → Messaging accounts** (e WhatsApp accounts, se aparecer) **→ Controle total**. O token só enxerga as contas atribuídas a ele.
6. **Ative o número na API.** No terminal, o token e o PIN são digitados sem aparecer:
   ```
   read -s -p "Token: " WA_TOKEN; echo
   read -s -p "PIN (6 digitos): " WA_PIN; echo
   curl -s -X POST "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/register" \
     -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
     -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"$WA_PIN\"}"; echo
   unset WA_TOKEN WA_PIN
   ```
   A resposta certa é `{"success":true}`. São no máximo 10 tentativas a cada 3 dias. A Meta está aposentando o PIN de 6 dígitos; se ele deixar de ser pedido, mande só `messaging_product`.
7. Troque `WHATSAPP_PHONE_NUMBER_ID` pelo ID do número brasileiro.

**Para conferir um número** sem mudar nada:
```
read -s -p "Token: " WA_TOKEN; echo
curl -s "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>?fields=display_phone_number,verified_name,code_verification_status,name_status,status,platform_type" -H "Authorization: Bearer $WA_TOKEN"; echo
unset WA_TOKEN
```
Um número pronto para a API mostra `code_verification_status: VERIFIED` e, depois de ativado, `platform_type: CLOUD_API`. `ON_PREMISE` com `DISCONNECTED` é um número que não está na API, por exemplo o do aplicativo.

**Se travar, o suporte:**
- **Meta Business Suite → Ajuda (?) → Entrar em contato com o suporte.** É um chat; escolha como ativo a conta de mensagens ("Outro ativo") e informe os IDs do portfólio, do app e da conta, mais o Session ID que aparece embaixo da tela do erro.
- Suporte para desenvolvedores: https://developers.facebook.com/support/
- Status da plataforma: https://metastatus.com/whatsapp-business-api

## 8. Passar para produção

Quando o número brasileiro estiver funcionando no dev (a verificação da empresa, Etapa 3, pode vir depois: sem ela, o limite é de cerca de 250 conversas iniciadas pela EmpowerFI por dia):
1. Repita os passos 1 a 6 no projeto prod (`efylyaroluqatqmtuuml`):
   - use o Phone number ID do número definitivo;
   - use a URL `https://efylyaroluqatqmtuuml.supabase.co/functions/v1/whatsapp-webhook`;
   - gere o segredo do lembrete com `journal-reminder-prod.env`.
2. O formulário e o modelo ficam na conta do WhatsApp, não no projeto. Se o número definitivo estiver na mesma conta, o Flow ID e o modelo continuam valendo.
3. O app só aceita um webhook por vez. Ao apontá-lo para prod, o dev deixa de receber mensagens. Se quiser os dois ao mesmo tempo, crie um segundo app para o dev.

## Quem recebe o lembrete

Depois de **7 dias seguidos sem registro**, ela recebe o aviso de pausa (5b) e mais nada, até registrar ou escrever.


Todo dia às 9h, recebe quem:
- está com o cadastro completo e ativo, ou seja, não pediu SAIR;
- se cadastrou antes de hoje;
- ainda não registrou nada de ontem, nem marcou como dia sem movimento.

Cada uma recebe no máximo um lembrete por dia. Se o envio falhar, ele fica anotado e não é repetido.
