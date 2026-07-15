# Acex Portaria

Sistema de gerenciamento de encomendas para condomínios.

## Tecnologias

- React + TypeScript + Vite
- Tailwind CSS
- Supabase
- React Router
- React Hook Form
- Zod
- Lucide React

## Configuração do Supabase

### 1. Projeto já criado!

As credenciais já estão configuradas no arquivo `.env`!

### 2. Executar SQL

Execute o arquivo `supabase-migration.sql` no SQL Editor do Supabase para criar as tabelas, políticas, índices e dados de exemplo.

### 3. Criar usuários no Supabase Auth

1. Acesse o painel do Supabase
2. Vá para **Authentication** → **Users**
3. Clique em **Add user** → **Create new user**
4. Crie dois usuários:
   - **Admin**: Email `admin@acex.com`, Senha `admin123` (marque "Auto Confirm User")
   - **Porteiro**: Email `porteiro@acex.com`, Senha `porteiro123` (marque "Auto Confirm User")

### 4. Inserir perfis no banco de dados

Depois de criar os usuários no Supabase Auth, copie os IDs dos usuários e execute o seguinte SQL no SQL Editor, substituindo os placeholders pelos IDs reais:

```sql
INSERT INTO profiles (id, email, name, role, condominium_id)
VALUES 
  ('ID_DO_USUARIO_ADMIN_AQUI', 'admin@acex.com', 'Administrador', 'admin', '550e8400-e29b-41d4-a716-446655440000'),
  ('ID_DO_USUARIO_PORTEIRO_AQUI', 'porteiro@acex.com', 'Porteiro', 'doorman', '550e8400-e29b-41d4-a716-446655440000');
```

## Configuração do Projeto

1. Copie o arquivo `.env.example` para `.env` (já configurado com as credenciais do Supabase)
2. (Opcional) Preencha as variáveis da Evolution API para envio de WhatsApp

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

## Evolution API

Para usar o envio automático de WhatsApp, é necessário configurar a Evolution API:

1. Instale e execute a Evolution API
2. Crie uma instância
3. Configure as variáveis de ambiente no arquivo `.env`:
   - `VITE_EVOLUTION_API_URL`
   - `VITE_EVOLUTION_API_KEY`
   - `VITE_EVOLUTION_INSTANCE`

## Perfis de Usuário

- **Porteiro**: Acesso a Nova Encomenda, Pendentes e Histórico
- **Admin**: Acesso a Dashboard, Moradores, Usuários e Configurações

## Arquitetura do Banco de Dados

- **auth.users**: Tabela padrão do Supabase Auth
- **profiles**: Perfil dos usuários, com relacionamento com `auth.users` e `condominiums`
- **condominiums**: Dados do condomínio
- **residents**: Moradores do condomínio
- **packages**: Encomendas (pendentes/entregues)
- **activity_logs**: Registro de atividades do sistema

## Row Level Security (RLS)

Todas as tabelas têm políticas de segurança configuradas para garantir que cada usuário só acesse os dados do seu condomínio.
