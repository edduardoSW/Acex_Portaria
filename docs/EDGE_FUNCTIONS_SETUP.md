# Deploy das Edge Functions (Supabase)

O app tem **6 Edge Functions**. Sem elas deployadas, algumas telas param de funcionar (gestão de
usuários, "esqueci minha senha" e notificação automática). Este guia cobre todas as 6.

> **Pré-requisito:** você precisa de acesso ao projeto Supabase `jgoilgxilwempiirbsph` — ou como
> **dono**, ou tendo sido **convidado como membro do projeto**. Sem esse acesso, o `supabase link`
> abaixo falha; nesse caso peça para o dono deployar (é rápido) ou pedir acesso.

---

## As 6 functions e o que cada uma faz

| Function | Powers (o que quebra sem ela) | Valida JWT no código | Trata CORS |
|----------|-------------------------------|:---:|:---:|
| `create-user` | Admin → Usuários → **Novo Usuário** | ✅ | ✅ |
| `update-user` | Admin → Usuários → **Editar** | ✅ | ✅ |
| `delete-user` | Admin → Usuários → **Excluir** (ou desativar) | ✅ | ⚠️ **não** |
| `request-password-reset` | Tela **"Esqueci minha senha"** (registra o pedido) | pública¹ | ✅ |
| `resolve-password-request` | Admin resolve o pedido de reset | ✅ | ✅ |
| `send-package-notification` | Notificação de encomenda via **Evolution API** (modo `evolution`) | ✅ | ⚠️ **não** |

¹ `request-password-reset` é **pública por design** (o usuário deslogado precisa chamá-la), então
não valida JWT — e deve continuar assim.

---

## Passo 1 — Instalar a Supabase CLI

Instruções oficiais: https://supabase.com/docs/guides/cli/getting-started

Confirme a instalação:

```bash
supabase --version
```

## Passo 2 — Vincular o projeto

Rode na raiz do repositório:

```bash
supabase link --project-ref jgoilgxilwempiirbsph
```

> O `--project-ref` é o ID do projeto (aparece na URL do painel:
> `https://supabase.com/dashboard/project/<PROJECT_REF>`). O `supabase init` **não** é necessário —
> o repositório já tem a pasta `supabase/`.

## Passo 3 — Deploy das 6 functions

```bash
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy update-user --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy request-password-reset --no-verify-jwt
supabase functions deploy resolve-password-request --no-verify-jwt
supabase functions deploy send-package-notification --no-verify-jwt
supabase functions deploy package-pickup --no-verify-jwt
```

## Confirmação de retirada por e-mail

Antes do deploy, aplique a migração `0003_package_pickup_email_codes.sql`. Depois configure os
secrets usados somente no servidor:

```bash
supabase secrets set RESEND_API_KEY=re_sua_chave
supabase secrets set EMAIL_FROM="Acex Portaria <portaria@seu-dominio.com>"
supabase secrets set SYSTEM_URL=https://seu-sistema.example
supabase functions deploy package-pickup --no-verify-jwt
```

A chave `RESEND_API_KEY` nunca deve usar o prefixo `VITE_`. O remetente precisa pertencer a um
domínio validado no Resend. A function autentica o JWT novamente no código antes de usar a chave
de serviço.

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são **injetados automaticamente** pelo Supabase nas
  functions — **não** configure à mão.
- Sempre que editar uma function, rode o `deploy` **dela** de novo.

## Passo 4 (opcional) — Secrets da Evolution API

Só é necessário se você for usar **WhatsApp automático** (`VITE_WHATSAPP_MODE=evolution`). A function
`send-package-notification` lê estes secrets no servidor:

```bash
supabase secrets set EVOLUTION_API_URL=<url-base-https-da-instancia>
supabase secrets set EVOLUTION_API_KEY=<api-key-da-evolution>
supabase secrets set EVOLUTION_INSTANCE=<nome-da-instancia>
supabase secrets list   # conferir
```

> 🔒 A `EVOLUTION_API_KEY` deve ficar **só** como secret de Edge Function — nunca em `VITE_*`
> (variáveis `VITE_` vão embutidas e públicas no bundle do navegador).

---

## Verificar o que está deployado

No painel do Supabase → **Edge Functions**, confira se as 6 aparecem na lista. Se algo não funciona
na tela, veja também **Edge Functions → Logs** para o erro real.

## Notas técnicas (dívidas conhecidas)

- **`--no-verify-jwt`** desliga a validação do JWT no *gateway* do Supabase. Como as functions usam a
  *service_role* (que ignora RLS), a checagem de `auth.getUser()` **dentro do código** vira a única
  barreira. 5 das 6 já validam o token no código; dá para reativar o gateway (remover `--no-verify-jwt`)
  nessas 5 quando quiser endurecer. A `request-password-reset` deve continuar pública.
- **`delete-user` e `send-package-notification` não tratam CORS/OPTIONS.** Chamadas do navegador podem
  falhar no *preflight*. Correção: adicionar os headers CORS + o handler de `OPTIONS` como nas outras 4.
- **`request-password-reset` permite enumeração de contas** (resposta diferente para e‑mail existente vs.
  inexistente) e não tem rate limiting — vale uniformizar a resposta e limitar tentativas.
- **Versões `std` inconsistentes** entre as functions (`std@0.192.0` vs `std@0.224.0`) — vale padronizar.
- `supabase/functions/_shared/passwordValidation.ts` não é importado por ninguém (cada function
  reimplementa a validação inline) — dá para centralizar.
