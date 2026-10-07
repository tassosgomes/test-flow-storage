import { notFound } from "next/navigation";
import { resultLabel } from "@tfs/schema";
import { Header } from "@/components/header";
import { SessionExplorer, type FileView } from "@/components/session-explorer";
import { formatWhen } from "@/lib/format";
import { getStore } from "@/lib/storage";
import { requireUser, sessionDetail } from "@/server/portal";

async function textOf(files: { relativePath: string; r2Key: string }[], name: string) {
  const file = files.find((item) => item.relativePath === name);
  if (!file) return null;
  const bytes = await getStore().get(file.r2Key);
  return bytes ? bytes.toString("utf8") : null;
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const user = await requireUser();
  const { slug, id } = await params;
  const detail = await sessionDetail(user.id, slug, id);
  if (!detail) notFound();
  const { round, files } = detail;
  const views: FileView[] = files
    .map((file) => ({
      id: file.id,
      relativePath: file.relativePath,
      caseId: file.caseId,
      unit: file.unit,
      contentType: file.contentType,
      size: file.size,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const order = round.units?.map((unit) => unit.dir) ?? [];
  const grouped = new Map<string, FileView[]>();
  for (const file of views) {
    if (!file.unit) continue;
    const list = grouped.get(file.unit) ?? [];
    list.push(file);
    grouped.set(file.unit, list);
  }
  const units = [...grouped.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map(([dir, group]) => ({
      dir,
      files: group.sort(
        (a, b) => (a.caseId || "").localeCompare(b.caseId || "") || a.relativePath.localeCompare(b.relativePath),
      ),
    }));
  const specs = views.filter((file) => /^spec\/.*\.(ts|tsx|js|mjs)$/.test(file.relativePath));
  const verdict = resultLabel(round.result?.overall);
  const environment = Object.entries(round.environment || {});
  return (
    <div className="shell">
      <Header email={user.email} crumb={`${detail.project.name} / ${round.externalId}`} />
      <main className="page wide">
        <div className="session-head">
          <h1>{round.externalId}</h1>
          <strong className={verdict === "APROVADO" ? "verdict ok" : verdict === "sem relatório" ? "verdict wait" : "verdict bad"}>
            {verdict}
          </strong>
        </div>
        <p className="muted">{formatWhen(round.startedAt)}</p>
        {round.artifactUnderTest ? (
          <p>
            <span className="muted">Artefato </span>
            {round.artifactUnderTest}
          </p>
        ) : null}
        {environment.length > 0 ? (
          <dl className="env">
            {environment.map(([key, value]) => (
              <span key={key}>
                <dt>{key}</dt>
                <dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd>
              </span>
            ))}
          </dl>
        ) : null}
        {round.result ? (
          <p className="counts">
            <span>PASS {round.result.pass}</span>
            <span>FAIL {round.result.fail}</span>
            <span>BLOCKED {round.result.blocked}</span>
            <span>NOT_EXECUTED {round.result.not_executed}</span>
          </p>
        ) : null}
        <SessionExplorer
          plan={await textOf(files, "qa_test_plan.md")}
          report={await textOf(files, "qa_report.md")}
          files={views}
          units={units}
          specs={specs}
        />
      </main>
    </div>
  );
}
