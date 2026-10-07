import { logout } from "@/server/actions";

export function Header({
  email,
  crumb,
}: {
  email: string;
  crumb?: string;
}) {
  return (
    <header className="topbar">
      <a className="brand" href="/projects">
        test-flow
      </a>
      {crumb ? <span className="crumb">{crumb}</span> : <span className="crumb">Projetos</span>}
      <span className="spacer" />
      <span className="who">{email}</span>
      <a className="nav" href="/settings/api-keys">
        Keys
      </a>
      <form action={logout}>
        <button className="linkish" type="submit">
          Sair
        </button>
      </form>
    </header>
  );
}
