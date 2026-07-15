# Configuração das Edge Functions do Supabase

Para que o gerenciamento de usuários funcione completamente pela interface, você precisa configurar as Edge Functions no Supabase:

## Passo 1: Instalar o Supabase CLI

Se você ainda não tem o Supabase CLI instalado, siga as instruções em: https://supabase.com/docs/guides/cli/getting-started

## Passo 2: Inicializar o Supabase (se necessário)

No diretório do projeto, execute:
```bash
supabase init
```

## Passo 3: Vincular o seu projeto do Supabase

```bash
supabase link --project-ref SEU_PROJECT_REF
```

Você pode encontrar o Project Ref no painel do Supabase, na URL do projeto (ex: https://supabase.com/dashboard/project/SEU_PROJECT_REF)

## Passo 4: Deploy das Edge Functions

```bash
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy update-user --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
```

## Passo 5: Configurar a Service Role Key

Certifique-se de que a Service Role Key está configurada nas variáveis de ambiente do Supabase (elas são configuradas automaticamente quando você vincula o projeto).

## Observações

- As Edge Functions são configuradas com `--no-verify-jwt` para simplificar o setup inicial. Para produção, você deve implementar autenticação adequada nas funções.
- Sempre que você fizer alterações nas Edge Functions, reexecute o comando `supabase functions deploy` para publicar as atualizações.
