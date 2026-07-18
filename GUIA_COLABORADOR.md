# Guia de onboarding do colaborador

Passo a passo para você começar a trabalhar no **Acex Portaria**. Siga na ordem — o único bloqueio
real para começar é **conseguir logar no app** (Passo 1). O resto é opcional ou já está pronto.

> **Alguns passos precisam de acesso ao Supabase** (projeto `jgoilgxilwempiirbsph`). Se você ainda
> não tem esse acesso, faça os passos "que você mesmo faz" e peça ao dono do projeto os que estão
> marcados com 🔑.

---

## ✅ Já está pronto (nada a fazer)

| Item | Estado |
|------|--------|
| `.env` com URL + `anon key` do Supabase | ✅ já vem no clone |
| Rodar local (`npm install` → `npm run dev` → `localhost:5173`) | ✅ funciona |
| Build de produção (`npm run build`) | ✅ passa, 0 erros |
| WhatsApp em modo **manual** (abre `wa.me`, sem backend) | ✅ funciona |

Ou seja: **você já consegue subir a aplicação**. Falta só ter um usuário para logar.

---

## Passo 1 — Conseguir seu login  ⛔ (obrigatório)

O login exige **3 coisas ao mesmo tempo**, senão o `Login.tsx` recusa a entrada:

1. um **usuário no Supabase Auth** com e‑mail confirmado;
2. uma **linha em `profiles`** com o **mesmo `id`** do usuário Auth, `role`, `status='active'` e `condominium_id`;
3. o **condomínio** desse `condominium_id` (já existe via seed: `550e8400-e29b-41d4-a716-446655440000`).

### 1a. Primeiro, teste se já existe login (talvez não precise fazer nada)

Com o app rodando (`npm run dev`), tente entrar com as credenciais de teste:

- **admin@acex.com** / **admin123**  → cai em `/admin`
- **porteiro@acex.com** / **porteiro123** → cai em `/porteiro`

Se **um deles logar**, ótimo — pule para o Passo 2. Se der *"Invalid login credentials"* ou
*"Perfil não encontrado"*, use um dos caminhos abaixo.

### 1b. Caminho A (mais fácil) — criar pela própria tela do app

*Requer:* um login **admin** já funcionando **e** as Edge Functions deployadas (ver [Passo 2](#passo-2--deploy-das-edge-functions--recomendado)).

1. Entre no app como **admin**.
2. **Usuários** (`/admin/usuarios`) → **Novo Usuário**.
3. Preencha nome, e‑mail, senha (**mín. 8 caracteres**) e função (**Porteiro** = `doorman` ou **Administrador** = `admin`).
4. Salvar. Pronto — a function `create-user` cria o usuário Auth **e** a linha em `profiles` de uma vez.

### 1c. Caminho B  🔑 (manual, pelo painel) — quando ainda não há admin funcionando

*Requer acesso ao painel do Supabase.*

1. Painel → **Authentication → Users → Add user → Create new user**.
2. Informe e‑mail + senha e **marque "Auto Confirm User"** (senão o login falha por e‑mail não confirmado).
3. Copie o **UUID** do usuário criado.
4. Abra o **SQL Editor** e rode (trocando UUID / e‑mail / nome):

   ```sql
   -- garante o condomínio (seed padrão):
   insert into condominiums (id, name)
   values ('550e8400-e29b-41d4-a716-446655440000', 'Condomínio Acex')
   on conflict (id) do nothing;

   -- cria o perfil vinculado ao usuário Auth:
   insert into profiles (id, email, name, role, condominium_id, status)
   values (
     '<UUID_DO_USUARIO_AUTH>',
     'seu-email@exemplo.com',
     'Seu Nome',
     'admin',                                    -- ou 'doorman'
     '550e8400-e29b-41d4-a716-446655440000',
     'active'
   );
   ```

   > ⚠️ `role` só aceita `'admin'` ou `'doorman'` (o rótulo "Porteiro" na tela = `doorman`).
   > ⚠️ Use **o mesmo `condominium_id`** do resto da equipe para enxergar os dados compartilhados.

5. Volte ao app e confirme que entra.

---

## Passo 2 — Deploy das Edge Functions  🔑 (recomendado)

Sem as 6 Edge Functions deployadas, **não funcionam**: novo/editar/excluir usuário pela tela de
admin e o **"Esqueci minha senha"**.

👉 Guia completo (CLI, `supabase link`, comandos de deploy): **[EDGE_FUNCTIONS_SETUP.md](EDGE_FUNCTIONS_SETUP.md)**.

Resumo dos comandos (precisa da Supabase CLI + acesso ao projeto):

```bash
supabase link --project-ref jgoilgxilwempiirbsph
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy update-user --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy request-password-reset --no-verify-jwt
supabase functions deploy resolve-password-request --no-verify-jwt
supabase functions deploy send-package-notification --no-verify-jwt
```

---

## Passo 3 — WhatsApp automático  📱 (opcional)

Hoje o app está em `VITE_WHATSAPP_MODE=manual` — abre o `wa.me` no navegador, **sem backend**.
Isso já resolve para a maioria dos casos.

Só configure se quiser **envio automático**: mude para `VITE_WHATSAPP_MODE=evolution` e cadastre os
secrets da Evolution API na Edge Function `send-package-notification` (passo a passo no
[EDGE_FUNCTIONS_SETUP.md](EDGE_FUNCTIONS_SETUP.md#passo-4-opcional--secrets-da-evolution-api)).

---

## Verificação read-only (opcional, recomendado)  🔑

Se tiver acesso ao SQL Editor, estes `SELECT`s confirmam que o banco está no estado esperado:

```sql
-- RLS ligado em todas as tabelas (rowsecurity deve ser true):
select tablename, rowsecurity from pg_tables where schemaname='public';

-- Seed presente (condomínio + moradores):
select id, name from condominiums where id='550e8400-e29b-41d4-a716-446655440000';
select count(*) as moradores from residents;

-- Seu perfil existe e está ativo, no condomínio certo:
select id, email, role, condominium_id, status from profiles where email='seu-email@exemplo.com';
```

---

## Referência rápida

| Chave | Valor |
|-------|-------|
| Supabase Project Ref | `jgoilgxilwempiirbsph` |
| Supabase URL | `https://jgoilgxilwempiirbsph.supabase.co` |
| Condomínio (seed) | `550e8400-e29b-41d4-a716-446655440000` — "Condomínio Acex" |
| Roles válidos | `admin`, `doorman` (rótulo "Porteiro" = `doorman`) |
| Senha mínima | 8 caracteres |
| Modo WhatsApp atual | `manual` |
| Rotas | admin → `/admin` · porteiro → `/porteiro` |

## O que pedir ao dono do projeto (se você não tem acesso ao Supabase)

1. **[Obrigatório] Meu login** — criar usuário Auth + linha em `profiles` (`role`, `status=active`,
   condomínio `550e8400-...440000`), conforme o Passo 1c. Ou confirmar que `admin@acex.com / admin123` funciona.
2. **[Recomendado] Deploy das 6 Edge Functions** (Passo 2) — sem isso a gestão de usuários pela tela e o reset de senha não funcionam.
3. **[Opcional] Me convidar como membro do projeto Supabase** — assim eu resolvo as próximas configurações sozinho.
