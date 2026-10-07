import { CopyButton } from "@/components/copy-button";
import { Header } from "@/components/header";
import { Badge, verdictTone } from "@/components/badge";
import { NewProjectForm } from "@/components/new-project-form";
import { formatWhen } from "@/lib/format";
import { listProjects, requireUser } from "@/server/portal";

function initialsOf(name: string) {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  const command = `tfs push qa-evidence --project ${projects[0]?.slug ?? "<slug>"}`;
  return (
    <div className="stack">
      <Header email={user.email} />
      <main className="page">
        <div className="page-head-text">
          <h1 className="page-title">Projetos</h1>
          <p className="page-sub">Cada projeto reúne as rodadas que o agente publica com tfs push.</p>
        </div>
        <div className="split">
          <section className="panel split-main">
            <div className="list-head">
              <span>
                {projects.length} PROJETO{projects.length === 1 ? "" : "S"}
              </span>
              <span>ordenado por atividade</span>
            </div>
            {projects.length === 0 ? <p className="empty-line">Nenhum projeto ainda.</p> : null}
            {projects.map((item) => (
              <a className="project-row" key={item.id} href={`/projects/${item.slug}`}>
                <span className="project-icon">{initialsOf(item.name)}</span>
                <span className="cell-stack">
                  <span className="project-name">{item.name}</span>
                  <span className="project-meta">
                    slug {item.slug}
                    {item.lastStartedAt ? ` · última rodada ${formatWhen(item.lastStartedAt)}` : " · sem rodadas"}
                  </span>
                </span>
                <span className="badges">
                  {item.recentVerdicts.map((label, index) => (
                    <Badge key={index} tone={verdictTone(label)}>
                      {label}
                    </Badge>
                  ))}
                </span>
                <span className="cell-mono secondary">
                  {item.sessionCount} {item.sessionCount === 1 ? "rodada" : "rodadas"}
                </span>
                <span className="arrow">→</span>
              </a>
            ))}
            <div className="list-body">
              <p className="label-12">O agente publica com</p>
              <div className="codebox">
                <span>
                  <span className="prompt">$ </span>
                  {command}
                </span>
                <CopyButton text={command} label="copiar" copiedLabel="copiado" className="copy-link" />
              </div>
              <p className="note">Requer TFS_API_URL e TFS_API_KEY no ambiente do agente.</p>
            </div>
          </section>
          <div className="split-side">
            <NewProjectForm />
          </div>
        </div>
      </main>
    </div>
  );
}
