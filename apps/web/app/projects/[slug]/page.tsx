import { notFound } from "next/navigation";
import { resultLabel } from "@tfs/schema";
import { Header } from "@/components/header";
import { formatWhen } from "@/lib/format";
import { projectBySlug, requireUser, sessionsForProject } from "@/server/portal";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const owned = await projectBySlug(user.id, slug);
  if (!owned) notFound();
  const rounds = await sessionsForProject(owned.id);
  rounds.sort((a, b) => Date.parse(b.startedAt || "") - Date.parse(a.startedAt || ""));
  return (
    <div className="shell">
      <Header email={user.email} crumb={owned.name} />
      <main className="page">
        <h1>Rodadas</h1>
        {rounds.length === 0 ? <p className="muted">Nenhuma rodada publicada.</p> : null}
        {rounds.map((round) => {
          const verdict = resultLabel(round.result?.overall);
          const verdictClass = verdict === "APROVADO" ? "ok" : verdict === "sem relatório" ? "wait" : "bad";
          return (
            <a className="round" key={round.id} href={`/projects/${slug}/sessions/${encodeURIComponent(round.externalId)}`}>
              <span className="id">{round.externalId}</span>
              <span className="when">{formatWhen(round.startedAt)}</span>
              <span>{round.title || round.artifactUnderTest}</span>
              <span className={`verdict ${verdictClass}`}>
                {verdict}
                {round.result ? (
                  <div className="muted">
                    {round.result.pass} pass · {round.result.fail} fail
                    <br />
                    {round.result.blocked} blocked · {round.result.not_executed} n/e
                  </div>
                ) : null}
              </span>
            </a>
          );
        })}
      </main>
    </div>
  );
}
