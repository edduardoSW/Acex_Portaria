# Trabalhando em dupla — GitHub + Supabase

Guia para **dois colaboradores** trabalharem no Acex Portaria **sem pisar no trabalho um do outro**.

> **Entenda o risco de cada lado:**
> - **GitHub** → 1 repositório compartilhado. Risco: conflito / sobrescrever o commit do outro.
> - **Supabase** → **1 projeto compartilhado** (`jgoilgxilwempiirbsph`): mesmo banco, mesmas Edge
>   Functions. **Não há "branch" no banco** — qualquer mudança de dados/schema/function que um faz, o
>   outro vê **na hora**. É aqui que mora o maior risco de "afetar o outro".

---

## Passo 0 — Acessos (fazer uma vez)

O **dono** (`edduardoSW`) precisa liberar os dois lados para quem ainda não tem:

1. **GitHub** (repo vai ficar privado): Settings → Collaborators → **Add people** (adicionar cada colaborador).
2. **Supabase**: painel do projeto → Settings → **Team → Invite** (dá acesso a SQL Editor, Edge Functions, logs).
3. **Login no app**: cada colaborador com seu **próprio** usuário (Auth + `profiles`), **mesmo `condominium_id`**
   para compartilhar os dados — ver [GUIA_COLABORADOR.md](GUIA_COLABORADOR.md) → Passo 1.

---

## Parte A — GitHub (fluxo de código)

### Regras de ouro
1. **Nunca commite direto na `main`.** Sempre em uma branch.
2. **`git pull` antes de começar** e **push cedo/frequente** (não acumule dias de trabalho local).
3. **Uma tarefa = uma branch = um Pull Request.** Merge só via PR.
4. **Combinem quem mexe em quê** para não editarem o mesmo arquivo ao mesmo tempo.
5. **Nunca `git push --force`** depois que o outro já clonou — reescrever histórico quebra o repo dele.

### Fluxo do dia a dia (cada um, toda vez)

```bash
git checkout main
git pull origin main                 # pega o que o outro já subiu
git checkout -b feat/minha-tarefa    # cria sua branch

# ...trabalha, commita quantas vezes quiser...
git add .
git commit -m "descrição do que fiz"

git push -u origin feat/minha-tarefa # sobe a branch
# abre o Pull Request no GitHub → o outro revisa → merge na main

git checkout main && git pull origin main   # sincroniza depois do merge
```

### Se der conflito no merge

```bash
git pull origin main
# o Git marca <<<<<<<  =======  >>>>>>>  nos arquivos em conflito.
# edite escolhendo o trecho certo (ou juntando os dois), depois:
git add <arquivo-resolvido>
git commit
```

### Higiene do repo (recomendado fazer 1x, evita conflito bobo)
- **Parar de versionar `dist/`**: é build gerado automaticamente; a Vercel reconstrói no deploy.
  Versioná-lo gera conflito/ruído a cada build. (Já está no `.gitignore`, mas foi commitado antes.)
  Correção: `git rm -r --cached dist` → commit.
- **`.gitattributes` com `* text=auto eol=lf`**: sem isso, Windows fica trocando fim de linha (LF↔CRLF)
  e cria "diffs fantasma" que atrapalham o outro.

---

## Parte B — Supabase (banco e Edge Functions compartilhados)

Como o projeto é **um só**, mudanças aqui são **globais na hora**. Regras para não derrubar o outro:

### Schema (tabelas, colunas, policies)
- Só via arquivos em [`supabase/migrations/`](../supabase/migrations/) — **versionados no Git**, aplicados de propósito.
- **Avise o outro antes de aplicar** uma migration (ele dá `git pull` e fica com o mesmo código).
- ⚠️ **NUNCA** rode o `schema-bootstrap.sql` inteiro — ele começa com `DROP TABLE ... CASCADE` (apaga tudo).

### Edge Functions
- `supabase functions deploy <nome>` **sobrescreve** a function no projeto compartilhado.
- Quem editou: **deploya e avisa**; o outro dá `git pull` para ter o código idêntico.
- Deploy de todas: ver [EDGE_FUNCTIONS_SETUP.md](EDGE_FUNCTIONS_SETUP.md).

### Dados
- Evitem `UPDATE`/`DELETE` **sem `WHERE`** (o `schema-bootstrap.sql`, por exemplo, sobrescreve o WhatsApp
  de *todos* os moradores).
- Para testar sem sujar os dados do outro: criem **registros de teste próprios** ou usem outro `condominium_id`.

### Secrets (Evolution API etc.)
- Ficam nos **secrets do Supabase** (não no código). Mudou algo? **Avise o outro.**

### Isolamento de verdade (opcional/avançado)
- **Supabase Branching**: cria um banco de *preview* por branch do Git, sem tocar produção (depende do
  plano; pode ter custo).
- Ou um **segundo projeto Supabase de staging** (mesmo schema) só para testes.

---

## Parte C — Rotina combinada (resumo)

1. **Combinar a tarefa** — quem faz o quê (evita colidir no mesmo arquivo/function).
2. **`git pull`** na `main`.
3. **Branch → trabalhar → PR → merge.**
4. **Mudou schema?** Migration versionada **+ avisar**.
5. **Mudou function?** Deploy **+ avisar** → o outro dá `pull`.
6. **Nunca `--force`** depois que o outro já clonou.

---

## Checklist inicial (fazer juntos, agora)

- [ ] Dono adiciona o colaborador no **GitHub** (repo privado) e no **Supabase** (Team).
- [ ] Ambos: `git clone` → `npm install` → `npm run dev`.
- [ ] Ambos: **login próprio** funcionando ([GUIA_COLABORADOR.md](GUIA_COLABORADOR.md) → Passo 1).
- [ ] **6 Edge Functions** deployadas ([EDGE_FUNCTIONS_SETUP.md](EDGE_FUNCTIONS_SETUP.md)).
- [ ] (Recomendado) parar de versionar `dist/` + adicionar `.gitattributes`.
- [ ] Combinar por escrito: **branches + PR, sem commit direto na `main`**.
