# E-mail comercial com Python na Vercel

O formulário público da landing page chama a função serverless Python
`api/send_sales_lead.py`. Ela valida os dados, recalcula o plano no servidor e envia o contato
para o endereço comercial por meio da API do Resend.

## Variáveis de ambiente

No projeto da Vercel, acesse **Settings → Environment Variables** e cadastre:

| Variável | Exemplo | Uso |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Chave privada criada no Resend |
| `EMAIL_FROM` | `ACEX Portaria <contato@seudominio.com.br>` | Remetente validado no Resend |
| `SALES_EMAIL` | `comercial@seudominio.com.br` | Caixa que recebe os novos leads |
| `ALLOWED_ORIGIN` | `https://seu-site.vercel.app` | Origem permitida no CORS (opcional) |

As variáveis devem ser habilitadas para **Production**, **Preview** e **Development** conforme o
ambiente desejado. Depois de salvar, faça um novo deploy.

## Segurança

- A chave do Resend fica somente no servidor Python; não use prefixo `VITE_`.
- O destinatário é definido por `SALES_EMAIL`, nunca pelo formulário.
- O plano e o preço são recalculados no servidor.
- O endpoint limita o tamanho da requisição e inclui um campo honeypot contra bots simples.
- Para alto volume público, acrescente rate limiting ou Turnstile na borda da Vercel.

## Teste após o deploy

Preencha o formulário da landing page e confira os logs em **Vercel → Functions**. Se a função
retornar “Canal de vendas ainda não configurado”, revise as três variáveis obrigatórias e confirme
que o domínio usado em `EMAIL_FROM` está validado no Resend.
