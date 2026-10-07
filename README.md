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

Na conta, crie um projeto e uma API key. A CLI usa essa chave:

```bash
export TFS_API_URL=http://localhost:3000
export TFS_API_KEY=tfs_...
npx tfs project list
npx tfs push qa-evidence --project <slug>
```

O deploy na Vercel usa o `vercel.json` da raiz. O app Next está em `apps/web`.
