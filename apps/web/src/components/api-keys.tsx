"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, revokeApiKeyAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { CopyButton } from "./copy-button";

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
    <div className="stack stack-lg">
      <form className="panel create-row" onSubmit={onCreate}>
        <label className="field">
          <span>Nome</span>
          <input name="name" placeholder="agente-local" required />
        </label>
        <button className="btn btn-primary" type="submit">
          Criar key
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {secret ? (
        <section className="secret-card">
          <div className="secret-title">
            <img src="/brand/icon-alert.svg" alt="" />
            <strong>Copie agora.</strong>
            <span>Ao sair desta tela o segredo não aparece de novo.</span>
          </div>
          <div className="secret-row">
            <code className="secret-value">{secret}</code>
            <CopyButton text={secret} />
          </div>
          <p className="eyebrow-label">
            {`export TFS_API_KEY=${secret.slice(0, 16)}…   export TFS_API_URL=${window.location.origin}`}
          </p>
        </section>
      ) : null}
      <section className="table">
        <div className="thead">
          <span className="grow">nome</span>
          <span className="col-160">prefixo</span>
          <span className="col-160">último uso</span>
          <span className="col-120">criada</span>
          <span className="col-96" />
        </div>
        {keys.length === 0 ? <p className="empty-line">Nenhuma key criada.</p> : null}
        {keys.map((key) => (
          <div className="trow" key={key.id}>
            <span className="grow key-name">{key.name}</span>
            <span className="cell-mono col-160">{key.prefix}…</span>
            <span className="cell-mono col-160">{key.lastUsedAt ? formatWhen(key.lastUsedAt) : "nunca"}</span>
            <span className="cell-mono col-120">{formatWhen(key.createdAt)}</span>
            <span className="col-96">
              <form action={revokeApiKeyAction}>
                <input type="hidden" name="id" value={key.id} />
                <button className="btn btn-danger" type="submit">
                  Revogar
                </button>
              </form>
            </span>
          </div>
        ))}
      </section>
      <p className="note">Guardamos só o hash e o prefixo. Revogar recusa a key na próxima chamada da CLI.</p>
    </div>
  );
}
