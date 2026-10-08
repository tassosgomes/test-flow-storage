import { logout } from "@/server/actions";
import { Logo } from "./logo";

export function Header({
  email,
  crumb,
}: {
  email: string;
  crumb?: string;
}) {
  return (
    <header className="topnav">
      <Logo />
      <span className="crumb-sep">/</span>
      <span className="crumb">{crumb ?? "Projetos"}</span>
      <div className="topnav-actions">
        <span className="topnav-email">{email}</span>
        <a className="nav" href="/settings/api-keys">
          API keys
        </a>
        <form action={logout}>
          <button className="linkish" type="submit">
            Sair
          </button>
        </form>
        <span className="avatar" aria-hidden>
          {email.charAt(0).toUpperCase() || "?"}
        </span>
      </div>
    </header>
  );
}
