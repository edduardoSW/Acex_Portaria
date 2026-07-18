# Configuração pendente — ações da pessoa principal (dono do Supabase)

> **Para quem é este documento:** para o **dono do projeto Supabase** (`edduardoSW`), que tem acesso ao
> painel do Supabase e à CLI. Eu (colaborador) já clonei o repositório e configurei **tudo que é local**.
> O que falta depende de acesso ao projeto Supabase `jgoilgxilwempiirbsph`, que **só o dono tem**.
>
> **Resumo em uma linha:** meu único bloqueio real para começar a trabalhar é **conseguir logar no app**.
> Todo o resto abaixo é opcional, de verificação, ou já está funcionando.

---

## ✅ O que já está pronto (nenhuma ação necessária)

| Item | Estado |
|------|--------|
| Repositório clonado (`edduardoSW/Acex_Portaria`) | ✅ feito na máquina do colaborador |
| `npm install` (254 pacotes) | ✅ feito |
| Build de produção `npm run build` (`tsc -b && vite build`) | ✅ passou, 0 erros |
| Servidor de dev `npm run dev` → `http://localhost:5173` | ✅ sobe normalmente |
| `.env` com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | ✅ veio junto no clone (o `.env` está versionado no repo) |
| WhatsApp em **modo manual** (`VITE_WHATSAPP_MODE=manual`) | ✅ funciona sem backend — abre link `wa.me` no navegador |

**Observação:** como o `.env` foi commitado no repositório, o colaborador **já recebeu** a URL e a
`anon key` (é a *publishable key*, pública por design). Ou seja, **não é preciso enviar essas credenciais** —
elas já vieram no clone. (Ver ponto de segurança no Apêndice B.)

---

## ⛔ BLOQUEIO #1 — Criar meu login (OBRIGATÓRIO, só o dono faz)

Sem isto **não consigo entrar no app**. Nenhum script SQL cria usuários automaticamente: o login exige,
ao mesmo tempo, **3 coisas**:

1. um **usuário no Supabase Auth** (Authentication → Users), com e‑mail confirmado;
2. uma **linha em `profiles`** com o **mesmo `id`** do usuário Auth, `role`, `status='active'` e `condominium_id`;
3. o **condomínio** referenciado por esse `condominium_id` (já existe via seed: `550e8400-e29b-41d4-a716-446655440000`).

> Se qualquer uma faltar, o `Login.tsx` recusa a entrada com *"Perfil não encontrado."* ou *"Usuário desativado."*

### Passo 0 — Verificar primeiro (talvez já esteja tudo pronto)

Peça para eu (ou você) **testar no navegador** com as credenciais de teste do README, no app já rodando:

- **admin@acex.com** / **admin123**
- **porteiro@acex.com** / **porteiro123**

Se **um desses logar**, ótimo — o dono não precisa fazer nada além de decidir se quero uma conta própria.
Se der *"Invalid login credentials"* / *"Perfil não encontrado"*, siga um dos caminhos abaixo.

### Caminho A (mais fácil) — criar o usuário pelo próprio app

*Requisito:* já existir **um login admin funcionando** e as Edge Functions `create-user`/`update-user`/`delete-user`
estarem **deployadas** (ver Bloqueio #2).

1. Logue no app como **admin**.
2. Vá em **Usuários** (`/admin/usuarios`) → **Novo Usuário**.
3. Preencha nome, e‑mail, senha (mín. **8 caracteres**) e função (**Porteiro** = `doorman` ou **Administrador** = `admin`).
4. Salvar. A função `create-user` cria **o usuário Auth + a linha em `profiles`** de uma vez, no mesmo condomínio.
5. Me passe esse e‑mail + senha. Pronto, sem SQL.

### Caminho B (manual, pelo painel) — quando não há admin funcionando ainda

1. Painel do Supabase (projeto `jgoilgxilwempiirbsph`) → **Authentication → Users → Add user → Create new user**.
2. Informe meu e‑mail + uma senha e **marque "Auto Confirm User"** (senão o login falha por e‑mail não confirmado).
3. Copie o **UUID** do usuário criado (aparece na lista de Users).
4. Abra o **SQL Editor** (roda como service_role, ignora RLS) e rode, trocando o UUID/e‑mail/nome:

   ```sql
   -- garante que o condomínio existe (seed padrão):
   insert into condominiums (id, name)
   values ('550e8400-e29b-41d4-a716-446655440000', 'Condomínio Acex')
   on conflict (id) do nothing;

   -- cria meu perfil vinculado ao usuário Auth:
   insert into profiles (id, email, name, role, condominium_id, status)
   values (
     '<UUID_DO_USUARIO_AUTH>',      -- UUID copiado no passo 3
     'meu-email@exemplo.com',
     'Meu Nome',
     'admin',                        -- ou 'doorman' se eu só for porteiro
     '550e8400-e29b-41d4-a716-446655440000',
     'active'
   );
   ```

   > ⚠️ `role` só aceita `'admin'` ou `'doorman'` (constraint do banco). O rótulo "Porteiro" na tela = `doorman`.
   > ⚠️ Use **o mesmo `condominium_id`** do resto da equipe (`550e8400-...440000`) para eu enxergar os dados compartilhados.

5. Confirme comigo que o login entra: admin cai em `/admin`, porteiro em `/porteiro`.

> **Sobre "convidar como membro do projeto Supabase":** isso dá acesso ao **painel** do Supabase (administrar
> banco/functions), **não** cria um login no app. Só faça isso se você quiser que eu ajude a administrar o
> Supabase; para *usar o app*, o que resolve é o usuário Auth + `profiles` acima. (Recomendado fazer os dois
> se você quiser me desbloquear para as próximas configurações também — ver Bloqueio #2.)

---

## 🔧 BLOQUEIO #2 — Deploy das Edge Functions (necessário p/ gestão de usuários e reset de senha)

O app tem **6 Edge Functions**, mas o `EDGE_FUNCTIONS_SETUP.md` só documenta **3**. Sem elas deployadas:
- **Novo/Editar/Excluir usuário** pela tela de admin não funciona;
- **"Esqueci minha senha"** não funciona (a tabela `password_reset_requests` não tem policy de INSERT no cliente
  — o registro do pedido só acontece via a function `request-password-reset`).

**Pré‑requisito:** instalar a Supabase CLI e vincular o projeto:

```bash
supabase link --project-ref jgoilgxilwempiirbsph
```

**Deployar as 6 functions** (as três em negrito faltam no doc oficial):

```bash
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy update-user --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy request-password-reset --no-verify-jwt      # faltava no doc
supabase functions deploy resolve-password-request --no-verify-jwt    # faltava no doc
supabase functions deploy send-package-notification --no-verify-jwt   # faltava no doc
```

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são **injetados automaticamente** pelo Supabase — **não** setar à mão.
- Sempre que editar uma function, rode o `deploy` dela de novo.
- ⚠️ `--no-verify-jwt` é aceitável só para começar. Ver Apêndice A (segurança).

*(Se preferir não usar a CLI agora, dá para desbloquear meu uso básico só com o Bloqueio #1; a gestão de
usuários pela tela e o reset de senha ficam indisponíveis até o deploy.)*

---

## 📱 OPCIONAL — WhatsApp automático (Evolution API)

**Não é necessário para começar.** Hoje o `.env` está em `VITE_WHATSAPP_MODE=manual`, e nesse modo o app só
abre o `wa.me` no navegador — **zero configuração de backend**.

Só configure isto se quiser **envio automático** (mudando para `VITE_WHATSAPP_MODE=evolution`). Nesse caso, a
function `send-package-notification` envia pela Evolution API e precisa destes **secrets no servidor**
(nunca no `.env` do front):

```bash
supabase secrets set EVOLUTION_API_URL=<url-base-https-da-instancia-evolution>
supabase secrets set EVOLUTION_API_KEY=<api-key-da-evolution>
supabase secrets set EVOLUTION_INSTANCE=<nome-da-instancia>
supabase secrets list   # conferir
```

> 🔒 **Importante:** a `EVOLUTION_API_KEY` deve ficar **só** como secret de Edge Function. Há um arquivo antigo
> `src/lib/whatsapp-service.ts` que lê `VITE_EVOLUTION_API_KEY` no front — qualquer variável `VITE_*` vai
> **embutida e pública** no bundle do navegador. Não preencha `VITE_EVOLUTION_API_KEY`; o caminho correto e
> seguro já existe na Edge Function. (Ver Apêndice A.)

---

## 🔍 OPCIONAL (recomendado) — Verificação read-only do projeto ao vivo

Toda a auditoria acima foi feita **lendo o código**; ninguém consultou o projeto `jgoilgxilwempiirbsph` ao vivo.
Vale o dono rodar estes `SELECT`s de leitura no **SQL Editor** para confirmar que o banco está no estado esperado:

```sql
-- 1) Colunas da tabela packages (espera-se whatsapp_* e notification_status presentes; photo_url AUSENTE):
select column_name from information_schema.columns
where table_schema='public' and table_name='packages' order by column_name;

-- 2) RLS ligado nas 6 tabelas (rowsecurity deve ser true em todas):
select tablename, rowsecurity from pg_tables where schemaname='public';

-- 3) Seed presente (condomínio + ~20 moradores):
select id, name from condominiums where id='550e8400-e29b-41d4-a716-446655440000';
select count(*) as moradores from residents;

-- 4) Meu perfil existe e está ativo, no condomínio certo:
select id, email, role, condominium_id, status from profiles where email='meu-email@exemplo.com';
```

Também dá para conferir quais Edge Functions estão realmente deployadas em **Edge Functions** no painel.

---

## 📸 Sobre a foto da encomenda (feature futura)

A coluna `packages.photo_url` **não existe** em nenhum lugar do projeto (nem no SQL, nem no código). Ela **não é
necessária hoje** — só será quando a feature de foto for implementada. Quando chegar a hora, o dono precisará:

```sql
alter table public.packages add column if not exists photo_url text;
```

…e criar um **bucket no Supabase Storage** (com policies por condomínio) para guardar as imagens.

---

## 📨 O que eu (colaborador) preciso de você — resumo para copiar/colar

> Oi! Já subi o Acex_Portaria aqui (build ok, `npm run dev` rodando). Para eu começar a trabalhar de fato,
> preciso de você (dono do Supabase):
>
> 1. **[Obrigatório] Meu login.** Ou confirme que `admin@acex.com / admin123` funciona, ou me crie um usuário
>    (Auth + `profiles`, `role` admin, `status=active`, condomínio `550e8400-...440000`) — passo a passo na
>    seção "Bloqueio #1" do `CONFIGURACAO_OWNER.md`.
> 2. **[Recomendado] Deploy das 6 Edge Functions** (o doc só cita 3) — sem isso a gestão de usuários pela tela e
>    o "Esqueci minha senha" não funcionam. Comandos na seção "Bloqueio #2".
> 3. **[Opcional] Me convidar como membro do projeto Supabase**, se você topar — assim eu resolvo as próximas
>    configurações sem depender de você a cada passo.
> 4. **[Opcional] WhatsApp automático** só se você quiser: setar os 3 secrets da Evolution (seção "WhatsApp automático").

---

## Apêndice A — Observações técnicas / dívidas encontradas na auditoria (recomendações)

Itens que **não bloqueiam** o uso, mas que a pessoa principal deveria conhecer/tratar antes de produção:

- **`--no-verify-jwt` em todas as functions.** O gateway do Supabase deixa de validar o JWT, e como as functions
  usam a *service_role* (que ignora RLS), a checagem de `auth.getUser()` **dentro do código** vira a única
  barreira. 5 das 6 já validam o token no código; vale reativar a verificação do gateway (remover
  `--no-verify-jwt`) nessas 5. A `request-password-reset` é pública por design e **deve** continuar assim.
- **`request-password-reset` permite enumeração de contas** (responde 404 para e‑mail inexistente vs. sucesso
  para existente) e **não tem rate limiting**. Recomendo resposta uniforme + limite de tentativas.
- **`delete-user` não trata CORS/OPTIONS.** O botão **Excluir** chamado do navegador pode falhar no *preflight*
  mesmo com a function deployada. Corrigir adicionando os headers CORS como nas outras functions.
- **`supabase-migration.sql` é destrutivo** — começa com `DROP TABLE ... CASCADE` em todas as tabelas. **Nunca**
  rode o arquivo inteiro no projeto compartilhado (apaga tudo). Use-o só para *bootstrap* de projeto novo. Os
  três arquivos em `supabase/migrations/` são idempotentes e seguros.
- **Seed sobrescreve telefones:** a última linha do `supabase-migration.sql` faz
  `UPDATE residents SET whatsapp='27996976726'` **sem WHERE** — troca o WhatsApp de *todos* os moradores por um
  número de teste. Ajustar após rodar em ambiente real.
- **Código duplicado:** `supabase/functions/_shared/passwordValidation.ts` não é importado por nenhuma function
  (cada uma reimplementa a validação inline). Dá para centralizar.
- **Versões `std` inconsistentes** entre as functions (`std@0.224.0` vs `std@0.192.0`) — padronizar.

## Apêndice B — Segurança do `.env`

O `.env` está **versionado no repositório** (apesar de constar no `.gitignore` — foi commitado antes). Hoje ele
só contém a URL e a *anon/publishable key* (públicas por design), então não há vazamento crítico. Mas o ideal é
**parar de rastreá-lo** para evitar que segredos futuros (ex.: chaves da Evolution) vazem:

```bash
git rm --cached .env
git commit -m "chore: remover .env do controle de versão"
```

E manter as credenciais reais apenas em `.env` local (front) e em **secrets do Supabase** (backend).

---

## Referência rápida — dados do projeto

| Chave | Valor |
|-------|-------|
| Supabase Project Ref | `jgoilgxilwempiirbsph` |
| Supabase URL | `https://jgoilgxilwempiirbsph.supabase.co` |
| Condomínio (seed) | `550e8400-e29b-41d4-a716-446655440000` — "Condomínio Acex" |
| Roles válidos | `admin`, `doorman` (rótulo "Porteiro" = `doorman`) |
| Senha mínima | 8 caracteres |
| Modo WhatsApp atual | `manual` (abre `wa.me`, sem backend) |
| Rotas | admin → `/admin` · porteiro → `/porteiro` |
