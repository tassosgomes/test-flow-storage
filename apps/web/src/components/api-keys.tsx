"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, revokeApiKeyAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function ApiKeys({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await createApiKeyAction(data);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setSecret(result.secret);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div>
      <p className="muted">A CLI usa TFS_API_KEY. O segredo aparece uma vez.</p>
      <form className="inline" onSubmit={onCreate}>
        <label className="field">
          <span>Nome</span>
          <input name="name" placeholder="agente-local" required />
        </label>
        <button className="primary" type="submit">
          Criar
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {secret ? (
        <div className="secret">
          <strong>Copie agora.</strong>
          <code>{secret}</code>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(secret);
              setCopied(true);
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      ) : null}
      <table className="keys">
        <thead>
          <tr>
            <th>nome</th>
            <th>prefixo</th>
            <th>último uso</th>
            <th>criada</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>{key.name}</td>
              <td>{key.prefix}…</td>
              <td>{key.lastUsedAt ? formatWhen(key.lastUsedAt) : "nunca"}</td>
              <td>{formatWhen(key.createdAt)}</td>
              <td>
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="id" value={key.id} />
                  <button className="ghost" type="submit">
                    Revogar
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
