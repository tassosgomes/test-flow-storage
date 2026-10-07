import { ApiKeys } from "@/components/api-keys";
import { Header } from "@/components/header";
import { listApiKeys, requireUser } from "@/server/portal";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);
  return (
    <div className="shell">
      <Header email={user.email} crumb="API keys" />
      <main className="page">
        <h1>API keys</h1>
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
