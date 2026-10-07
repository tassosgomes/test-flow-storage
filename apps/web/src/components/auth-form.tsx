"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const title = mode === "login" ? "Entrar" : "Criar conta";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const result =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: email.split("@")[0] || "QA" });
    setPending(false);
    if (result.error) {
      setError(mode === "login" ? "E-mail ou senha não conferem." : "Não foi possível criar a conta.");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <main className="auth-card">
      <a className="brand" href="/login">
        test-flow
      </a>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Senha</span>
          <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="submit" disabled={pending}>
          {title}
        </button>
      </form>
      <p className="muted">
        {mode === "login" ? (
          <a href="/signup">Ainda sem conta? Criar conta</a>
        ) : (
          <a href="/login">Já tem conta? Entrar</a>
        )}
      </p>
    </main>
  );
}
