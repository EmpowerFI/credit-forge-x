# Ligar o WhatsApp: passo a passo na Meta

**Para:** a fundadora, que faz estes passos no painel da Meta e no do Supabase. O código já está pronto. Aqui estão só as configurações, na ordem certa.

Comece pelo **projeto dev** (`boivrcjvsnrmzbregavl`) com o **número de teste** da Meta, que não exige verificação da empresa nem cartão. Quando tudo funcionar, repita no **projeto prod** (`efylyaroluqatqmtuuml`) com o número definitivo.

Nenhuma chave, token ou segredo deste guia vai para o chat ou para o repositório. Cada um vai direto para o painel do Supabase, em **Edge Functions → Secrets**.

---

## 1. O app e o número de teste

1. Em https://developers.facebook.com/apps, abra o app da EmpowerFI. Se ainda não existir, crie um: **Create app → Business → WhatsApp**.
2. No menu do app, abra **WhatsApp → API Setup**. Anote:
   - **Phone number ID**, o número que aparece embaixo do número de teste (não é o número de telefone);
   - o campo **To**: adicione o seu celular. O número de teste só manda mensagem para até 5 números cadastrados ali.
3. **App secret:** em **App settings → Basic**, clique em **Show** ao lado de *App secret*.
4. **Token permanente.** O token que aparece em *API Setup* vence em 24 horas, então não use esse. Faça assim:
   1. Abra https://business.facebook.com/settings → **Users → System users → Add**, com nome `empowerfi-api` e papel **Admin**.
   2. Em **Assign assets**, dê **controle total** ao app e à conta do WhatsApp.
   3. Clique em **Generate new token**, escolha o app, a validade **Never** e as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
   4. O token aparece **uma vez só**. Copie direto para o passo 2.

## 2. Os segredos no Supabase

No painel do Supabase, projeto **dev**, abra **Edge Functions → Secrets** e adicione:

| nome | valor |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | uma senha que você inventa, longa, por exemplo 30 letras e números. Ela vai de novo no passo 3 |
| `WHATSAPP_APP_SECRET` | o *App secret* do passo 1.3 |
| `WHATSAPP_TOKEN` | o token permanente do passo 1.4 |
| `WHATSAPP_PHONE_NUMBER_ID` | o *Phone number ID* do passo 1.2 |

(`ANTHROPIC_API_KEY` e `OPENAI_API_KEY` já estão lá.)

## 3. O webhook: onde a Meta entrega as mensagens

1. No app, abra **WhatsApp → Configuration → Webhook → Edit**.
2. Preencha:
   - **Callback URL:** `https://boivrcjvsnrmzbregavl.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify token:** a mesma senha de `WHATSAPP_VERIFY_TOKEN`.
3. Clique em **Verify and save**. Se der erro, confira se a senha é exatamente a mesma e se a função `whatsapp-webhook` foi publicada.
4. Em **Webhook fields**, ative (**Subscribe**) o campo **messages**.

**Teste:** do seu celular, mande **OI** para o número de teste. A mensagem de boas-vindas deve chegar. Siga o cadastro até o fim.

## 4. O formulário do diário

1. Abra o **WhatsApp Manager**: https://business.facebook.com/wa/manage → **Account tools → Flows → Create Flow**.
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

Abra **WhatsApp Manager → Message templates → Create template** e preencha:

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

## 7. Passar para produção

Quando o número definitivo existir (precisa de verificação da empresa e de uma forma de pagamento na conta do WhatsApp):
1. Repita os passos 1 a 6 no projeto prod (`efylyaroluqatqmtuuml`):
   - use o Phone number ID do número definitivo;
   - use a URL `https://efylyaroluqatqmtuuml.supabase.co/functions/v1/whatsapp-webhook`;
   - gere o segredo do lembrete com `journal-reminder-prod.env`.
2. O formulário e o modelo ficam na conta do WhatsApp, não no projeto. Se o número definitivo estiver na mesma conta, o Flow ID e o modelo continuam valendo.
3. O app só aceita um webhook por vez. Ao apontá-lo para prod, o dev deixa de receber mensagens. Se quiser os dois ao mesmo tempo, crie um segundo app para o dev.

## Quem recebe o lembrete

Todo dia às 9h, recebe quem:
- está com o cadastro completo e ativo, ou seja, não pediu SAIR;
- se cadastrou antes de hoje;
- ainda não registrou nada de ontem, nem marcou como dia sem movimento.

Cada uma recebe no máximo um lembrete por dia. Se o envio falhar, ele fica anotado e não é repetido.
