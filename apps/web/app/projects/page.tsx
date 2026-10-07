import { Header } from "@/components/header";
import { NewProjectForm } from "@/components/new-project-form";
import { listProjects, requireUser } from "@/server/portal";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  return (
    <div className="shell">
      <Header email={user.email} />
      <main className="page">
        <h1>Projetos</h1>
        <div className="split">
          <div>
            {projects.length === 0 ? (
              <article className="card">
                <p>Nenhum projeto ainda.</p>
                <p className="muted">O agente publica com tfs push qa-evidence --project …</p>
              </article>
            ) : (
              projects.map((item) => (
                <a className="card project-link" key={item.id} href={`/projects/${item.slug}`}>
                  <span>
                    <strong>{item.name}</strong>
                    <div className="muted">slug {item.slug}</div>
                  </span>
                  <span>{item.sessionCount} rodadas</span>
                </a>
              ))
            )}
          </div>
          <NewProjectForm />
        </div>
      </main>
    </div>
  );
}
