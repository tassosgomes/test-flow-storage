import { notFound } from "next/navigation";
import { VerdictBadge } from "@/components/badge";
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

function CountTile({ tone, label, value }: { tone: "pass" | "fail" | "blocked" | "ne"; label: string; value: number | null }) {
  const dot = tone === "ne" ? "dot-ne" : `dot-${tone}`;
  return (
    <div className={`count ${tone === "pass" ? "pass" : tone === "ne" ? "ne" : ""}`}>
      <span className="count-label">
        <img src={`/brand/${dot}.svg`} alt="" width={6} height={6} />
        {label}
      </span>
      <span className="count-value">{value ?? "—"}</span>
    </div>
  );
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
  const environment = Object.entries(round.environment || {});
  const unitRange =
    units.length > 1 ? `${units[0].dir} … ${units[units.length - 1].dir}` : (units[0]?.dir ?? null);
  const command = `tfs push qa-evidence --project ${slug}`;
  const top = (
    <div className="session-top">
      <div className="session-meta">
        <div className="session-title-row">
          <h1 className="session-title">{round.externalId}</h1>
          <VerdictBadge overall={round.result?.overall} />
        </div>
        <p className="session-when">{formatWhen(round.startedAt)} UTC</p>
        <dl className="kv">
          {round.artifactUnderTest ? (
            <div className="kv-row">
              <dt>Artefato</dt>
              <dd>{round.artifactUnderTest}</dd>
            </div>
          ) : null}
          {unitRange ? (
            <div className="kv-row">
              <dt>Unidades</dt>
              <dd className="mono">
                {unitRange}
                {units.length > 1 ? `  ·  ${units.length} unidades` : ""}
              </dd>
            </div>
          ) : null}
          {environment.length > 0 ? (
            <div className="kv-row">
              <dt>Ambiente</dt>
              <dd>
                <div className="env-list">
                  {environment.map(([key, value]) => (
                    <div className="env-item" key={key}>
                      <span>{key}</span>
                      <span>{typeof value === "string" ? value : JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="counts">
        <CountTile tone="pass" label="PASS" value={round.result?.pass ?? null} />
        <CountTile tone="fail" label="FAIL" value={round.result?.fail ?? null} />
        <CountTile tone="blocked" label="BLOCKED" value={round.result?.blocked ?? null} />
        <CountTile tone="ne" label="NOT_EXECUTED" value={round.result?.not_executed ?? null} />
      </div>
    </div>
  );
  return (
    <div className="stack">
      <Header email={user.email} crumb={`${detail.project.name} / ${round.externalId}`} />
      <SessionExplorer
        top={top}
        command={command}
        plan={await textOf(files, "qa_test_plan.md")}
        report={await textOf(files, "qa_report.md")}
        planFile={views.find((file) => file.relativePath === "qa_test_plan.md") ?? null}
        reportFile={views.find((file) => file.relativePath === "qa_report.md") ?? null}
        files={views}
        units={units}
        specs={specs}
      />
    </div>
  );
}
