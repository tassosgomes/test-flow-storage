import { notFound } from "next/navigation";
import { resultLabel } from "@tfs/schema";
import { VerdictBadge } from "@/components/badge";
import { Header } from "@/components/header";
import { formatWhen } from "@/lib/format";
import { projectBySlug, requireUser, sessionsForProject } from "@/server/portal";

type Round = Awaited<ReturnType<typeof sessionsForProject>>[number];

function CaseBar({ round }: { round: Round }) {
  const result = round.result;
  if (!result) return <span className="cell-mono muted-cell">relatório ainda não publicado</span>;
  const total = result.pass + result.fail + result.blocked + result.not_executed;
  const share = (count: number) => (total > 0 ? `${(count / total) * 100}%` : "0%");
  return (
    <span className="cell-stack">
      {total > 0 ? (
        <span className="bar">
          {result.pass > 0 ? <span className="seg-pass" style={{ width: share(result.pass) }} /> : null}
          {result.fail > 0 ? <span className="seg-fail" style={{ width: share(result.fail) }} /> : null}
          {result.blocked > 0 ? <span className="seg-blocked" style={{ width: share(result.blocked) }} /> : null}
          {result.not_executed > 0 ? <span className="seg-ne" style={{ width: share(result.not_executed) }} /> : null}
        </span>
      ) : null}
      <span className="cell-mono muted-cell">
        {result.pass} pass · {result.fail} fail · {result.blocked} blocked · {result.not_executed} n/e
      </span>
    </span>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const owned = await projectBySlug(user.id, slug);
  if (!owned) notFound();
  const rounds = await sessionsForProject(owned.id);
  rounds.sort((a, b) => Date.parse(b.startedAt || "") - Date.parse(a.startedAt || ""));
  const labels = rounds.map((round) => resultLabel(round.result?.overall));
  const approved = labels.filter((label) => label === "APROVADO").length;
  const pending = labels.filter((label) => label === "sem relatório").length;
  return (
    <div className="stack">
      <Header email={user.email} crumb={owned.name} />
      <main className="page">
        <div className="page-head">
          <div className="page-head-text">
            <span className="eyebrow-label">PROJETO</span>
            <h1 className="page-title">{owned.name}</h1>
            <p className="page-sub">Rodadas publicadas pelo agente. Cada linha abre a rodada.</p>
          </div>
          <div className="tiles">
            <div className="tile">
              <span className="tile-value">{rounds.length}</span>
              <span className="tile-label">rodadas</span>
            </div>
            <div className="tile">
              <span className="tile-value pass">{approved}</span>
              <span className="tile-label">aprovadas</span>
            </div>
            <div className="tile">
              <span className="tile-value ne">{pending}</span>
              <span className="tile-label">sem relatório</span>
            </div>
          </div>
        </div>
        <section className="table">
          <div className="thead">
            <span className="grow">rodada</span>
            <span className="col-150">início</span>
            <span className="col-150">resultado</span>
            <span className="col-300">casos</span>
            <span className="col-spacer" />
          </div>
          {rounds.length === 0 ? <p className="empty-line">Nenhuma rodada publicada.</p> : null}
          {rounds.map((round) => (
            <a
              className="trow"
              key={round.id}
              href={`/projects/${slug}/sessions/${encodeURIComponent(round.externalId)}`}
            >
              <span className="cell-stack">
                <span className="cell-name">{round.externalId}</span>
                <span className="cell-desc">{round.title || round.artifactUnderTest || "Sem descrição"}</span>
              </span>
              <span className="cell-mono col-150">{formatWhen(round.startedAt)}</span>
              <span className="col-150">
                <VerdictBadge overall={round.result?.overall} />
              </span>
              <span className="col-300">
                <CaseBar round={round} />
              </span>
              <span className="arrow">→</span>
            </a>
          ))}
        </section>
        <p className="note">
          Sem session.result no qa_session.json, a rodada aparece como &quot;sem relatório&quot;. Um novo tfs push com o
          mesmo session.id substitui os arquivos.
        </p>
      </main>
    </div>
  );
}
