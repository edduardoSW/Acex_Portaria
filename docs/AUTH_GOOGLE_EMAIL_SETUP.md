# Login Google e recuperação de senha por e-mail

O front-end já contém os dois fluxos:

- `Continuar com Google`, usando `supabase.auth.signInWithOAuth()`;
- `Esqueci minha senha`, usando `supabase.auth.resetPasswordForEmail()` e a rota pública `/redefinir-senha`.

Para funcionar em produção, conclua a configuração abaixo no mesmo projeto Supabase usado pelo site.

## 1. URLs de redirecionamento

No Supabase, abra **Authentication → URL Configuration**:

1. Defina **Site URL** com o domínio público do ACEX Portaria.
2. Adicione em **Redirect URLs**:
   - `https://SEU-DOMINIO/login`
   - `https://SEU-DOMINIO/redefinir-senha`
   - `http://localhost:5173/login`
   - `http://localhost:5173/redefinir-senha`

Sem essas URLs, o Supabase pode bloquear o retorno do Google ou do link de recuperação.

## 2. Ativar login com Google

1. No Google Auth Platform, crie um cliente OAuth do tipo **Web application**.
2. Em **Authorized JavaScript origins**, adicione o domínio público e o endereço local usado no desenvolvimento.
3. Em **Authorized redirect URIs**, adicione o callback exibido em **Supabase → Authentication → Providers → Google**. Normalmente ele segue o formato:
   `https://SEU-PROJECT-REF.supabase.co/auth/v1/callback`.
4. Copie o Client ID e Client Secret para o provedor Google no Supabase e ative-o.
5. Somente depois de confirmar que o provedor está ativo, defina `VITE_ENABLE_GOOGLE_LOGIN=true` no ambiente de deploy e gere um novo build.

Enquanto essa variável não estiver definida como `true`, o botão Google fica oculto. Isso evita que o usuário seja enviado para a resposta `provider is not enabled` do Supabase.

O acesso pelo Google é permitido somente quando o usuário autenticado possui uma linha correspondente em `public.profiles`. Isso preserva o condomínio, o papel e o status existentes. Contas Google sem perfil são desconectadas com uma mensagem orientando o contato com o administrador.

## 3. Entrega dos e-mails de recuperação

O Supabase pode usar o remetente padrão durante testes, sujeito aos limites da plataforma. Para produção, configure um SMTP próprio em **Authentication → Email/SMTP** e revise o template de recuperação de senha.

O link do e-mail direciona para `/redefinir-senha`, onde o usuário informa e confirma a nova senha. Após a atualização, a sessão de recuperação é encerrada e o usuário volta ao login.

