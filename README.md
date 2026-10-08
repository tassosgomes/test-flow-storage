# test-flow

Portal para guardar os planos e as evidências que a skill `flow-qa` grava em `qa-evidence`.

O metadado fica no Postgres (Neon em produção). Os arquivos ficam num bucket privado do Cloudflare R2. Sem as variáveis do R2, o processo grava os objetos em disco.

## Ambiente

Copie `.env.example` para `apps/web/.env.local` e preencha `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`. Para o R2, preencha `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET`.

```bash
npm install
npm run db:push
npm run dev
```

O `dev` e o `build` do web compilam `@tfs/schema` antes de rodar (`predev` e `prebuild`). O `npm install` não compila nada.

Na conta, crie um projeto e uma API key. A CLI usa essa chave:

```bash
npm run build -w @tfs/schema
npm run build -w @tfs/cli
export TFS_API_URL=http://localhost:3000
export TFS_API_KEY=tfs_...
npx tfs project list
npx tfs push qa-evidence --project <slug>
```

## CLI

A CLI não vai para a Vercel. O workflow `.github/workflows/cli.yml` roda build e testes em PRs e pushes para `main`. Para publicar, crie uma tag `cli-v<versão>` que bata com `packages/cli/package.json`. O workflow gera `tfs-<versão>.js` com o `sha256` e cria um GitHub Release com os dois arquivos.

### Instalação pelo GitHub Release

Requer Node.js 20 ou superior. Baixe o `tfs-<versão>.js` e o `checksums.txt` da última release em `https://github.com/tassosgomes/test-flow-storage/releases`.

```bash
sha256sum -c checksums.txt
install -m 755 tfs-<versão>.js ~/.local/bin/tfs
tfs --help
```

Se `~/.local/bin` não estiver no `PATH`, adicione essa pasta ao seu shell ou mova o arquivo para outro diretório do `PATH`.

### Instalação a partir do código-fonte

```bash
npm install
npm run build -w @tfs/schema
npm run build -w @tfs/cli
npx tfs --help
```

O `npm install` não compila a CLI, então esses dois `build` são necessários antes do primeiro uso.

### Configuração

A CLI lê `TFS_API_URL` e `TFS_API_KEY` do ambiente. Ela não carrega o `.env.local`, então exporte as variáveis no terminal:

```bash
export TFS_API_URL=https://<url-do-portal>
export TFS_API_KEY=tfs_...
tfs project list
tfs push qa-evidence --project <slug>
```

O deploy na Vercel é do app Next em `apps/web`, com Root Directory `apps/web`.
