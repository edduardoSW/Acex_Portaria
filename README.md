# Acex Portaria

Sistema de gerenciamento de encomendas para condomínios: o porteiro registra encomendas,
notifica o morador (WhatsApp) e dá baixa na entrega; o administrador gerencia moradores,
usuários e acompanha um dashboard.

> **Chegou agora no projeto?** Comece pelo **[GUIA_COLABORADOR.md](docs/GUIA_COLABORADOR.md)** —
> é o passo a passo de onboarding do colaborador (o que já está pronto e o que falta para você
> conseguir logar e trabalhar).

---

## Stack

- **React 18 + TypeScript + Vite** (front-end)
- **Tailwind CSS** (estilo)
- **Supabase** (Postgres + Auth + Edge Functions + RLS)
- **React Router**, **React Hook Form**, **Zod**, **Lucide React**

## Rodar localmente (5 minutos)

O projeto Supabase **já existe e já está populado**, e o `.env` **já vem no repositório** — então
para subir a aplicação local basta:

```bash
npm install      # instala as dependências (~254 pacotes)
npm run dev      # sobe em http://localhost:5173
```

Outros comandos:

```bash
npm run build    # build de produção (tsc -b && vite build)
npm run preview  # serve o build localmente
npm run lint     # ESLint
```

> Para **logar** no app você precisa de um usuário válido (Auth + `profiles`). Isso depende de
> acesso ao Supabase e está detalhado no **[GUIA_COLABORADOR.md](docs/GUIA_COLABORADOR.md)** → "Passo 1".

## Variáveis de ambiente (`.env`)

Já vêm preenchidas no clone. Referência:

| Variável | Para quê | Valor atual |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | preenchida |
| `VITE_SUPABASE_ANON_KEY` | *publishable/anon key* (pública por design) | preenchida |
| `VITE_WHATSAPP_MODE` | `manual` (abre `wa.me`) ou `evolution` (envio automático) | `manual` |
| `VITE_EVOLUTION_API_URL` / `_API_KEY` / `_INSTANCE` | só no modo `evolution` | vazias |

> ⚠️ Tudo que começa com `VITE_` é **embutido no bundle** e fica visível para quem abre o site.
> Nunca coloque segredos de servidor (ex.: a API key da Evolution) em variáveis `VITE_*` — o lugar
> certo delas é em **secrets de Edge Function** (ver [EDGE_FUNCTIONS_SETUP.md](docs/EDGE_FUNCTIONS_SETUP.md)).

## Perfis de usuário

- **Porteiro** (`doorman`) → Nova Encomenda, Pendentes, Histórico. Cai em `/porteiro`.
- **Admin** (`admin`) → Dashboard, Moradores, Usuários, Configurações. Cai em `/admin`.

## Banco de dados

Tabelas principais (todas com **Row Level Security** por condomínio):

| Tabela | Papel |
|--------|-------|
| `auth.users` | usuários do Supabase Auth (padrão) |
| `profiles` | perfil do usuário (`role`, `status`, `condominium_id`) — vinculado 1:1 a `auth.users` |
| `condominiums` | dados do condomínio |
| `residents` | moradores |
| `packages` | encomendas (pendentes/entregues) |
| `activity_logs` | registro de atividades |

### Sobre os arquivos SQL

- O banco compartilhado **já está criado e com seed** — você **não** precisa rodar SQL para trabalhar.
- Para **criar um projeto novo do zero**: rode o
  [`supabase/schema-bootstrap.sql`](supabase/schema-bootstrap.sql) (cria todo o schema + seed) e depois
  aplique as correções de [`supabase/migrations/`](supabase/migrations/).
- ⚠️ **NUNCA** rode o `schema-bootstrap.sql` no projeto **compartilhado**: ele começa com
  `DROP TABLE ... CASCADE` (apaga tudo) e sobrescreve os telefones dos moradores. É só para
  *bootstrap* de projeto novo.

## Documentação do repositório

| Arquivo | Para quê |
|---------|----------|
| **[GUIA_COLABORADOR.md](docs/GUIA_COLABORADOR.md)** | Onboarding do colaborador: o que já está pronto e o que falta para começar. |
| **[COLABORACAO.md](docs/COLABORACAO.md)** | Trabalhar em dupla sem conflito (fluxo Git + regras do Supabase compartilhado). |
| **[EDGE_FUNCTIONS_SETUP.md](docs/EDGE_FUNCTIONS_SETUP.md)** | Deploy das 6 Edge Functions (gestão de usuários, reset de senha, notificação). |
