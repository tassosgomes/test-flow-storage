import { ApiKeys } from "@/components/api-keys";
import { Header } from "@/components/header";
import { listApiKeys, requireUser } from "@/server/portal";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);
  return (
    <div className="stack">
      <Header email={user.email} crumb="API keys" />
      <main className="page narrow">
        <div className="page-head-text">
          <h1 className="page-title">API keys</h1>
          <p className="page-sub">A CLI usa TFS_API_KEY. O segredo aparece uma vez.</p>
        </div>
        <ApiKeys
          keys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
          }))}
        />
      </main>
    </div>
  );
}
