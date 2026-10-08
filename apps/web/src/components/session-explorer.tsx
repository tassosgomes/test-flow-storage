"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatSize } from "@/lib/format";
import { CopyButton } from "./copy-button";

export type FileView = {
  id: string;
  relativePath: string;
  caseId: string | null;
  unit: string | null;
  contentType: string;
  size: number;
};

type UnitGroup = { dir: string; files: FileView[] };

const TABS = ["Plano", "Relatório", "Unidades", "Spec"] as const;
type Tab = (typeof TABS)[number];

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];
const VIDEO_EXT = ["webm", "mp4"];

export function headingId(text: string) {
  return (
    "md-" +
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return plainText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function headingsOf(markdown: string | null) {
  if (!markdown) return [];
  return markdown.split("\n").flatMap((line) => {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    return match ? [{ level: match[1].length, text: match[2] }] : [];
  });
}

function resolveEvidence(token: string, paths: string[]) {
  const clean = token
    .trim()
    .replace(/^[`'"()]+/, "")
    .replace(/[`'"(),.:]+$/, "")
    .replace(/^\.\//, "");
  if (!clean || /\s/.test(clean)) return null;
  if (paths.includes(clean)) return clean;
  const suffix = paths.filter((item) => item.endsWith(`/${clean}`));
  if (suffix.length === 1) return suffix[0];
  const name = clean.split("/").pop() ?? clean;
  if (!name.includes(".")) return null;
  const byName = paths.filter((item) => item.split("/").pop() === name);
  return byName.length === 1 ? byName[0] : null;
}

function extOf(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function baseName(path: string) {
  return path.split("/").pop() ?? path;
}

function CodeView({ text }: { text: string }) {
  return (
    <pre className="codeview">
      {text.split("\n").map((line, index) => (
        <span className="codeview-line" key={index}>
          <span className="ln">{index + 1}</span>
          <span>{line || " "}</span>
        </span>
      ))}
    </pre>
  );
}

function TextBody({ id, json }: { id: string; json: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    void fetch(`/api/portal/artifacts/${id}`)
      .then((response) => response.text())
      .then((value) => {
        if (cancel) return;
        if (!json) {
          setText(value);
          return;
        }
        try {
          setText(JSON.stringify(JSON.parse(value), null, 2));
        } catch {
          setText(value);
        }
      });
    return () => {
      cancel = true;
    };
  }, [id, json]);
  return text === null ? <p className="viewer-empty">Carregando…</p> : <CodeView text={text} />;
}

function FileBody({ file }: { file: FileView }) {
  const ext = extOf(file.relativePath);
  const src = `/api/portal/artifacts/${file.id}`;
  if (IMAGE_EXT.includes(ext)) {
    return (
      <div className="preview-img">
        <img src={src} alt={file.relativePath} />
      </div>
    );
  }
  if (VIDEO_EXT.includes(ext)) {
    return (
      <div className="preview-video">
        <video src={src} controls />
      </div>
    );
  }
  return <TextBody id={file.id} json={ext === "json"} />;
}

function Viewer({ file, spec, onBack }: { file: FileView; spec: boolean; onBack?: () => void }) {
  const src = `/api/portal/artifacts/${file.id}`;
  const name = spec ? file.relativePath : baseName(file.relativePath);
  return (
    <>
      <div className="viewer-head">
        <div className="viewer-info">
          <span className="viewer-name">{name}</span>
          <span className="viewer-meta">
            {file.unit ? `${file.unit}${file.caseId ? ` · ${file.caseId}` : ""}` : "raiz"}
          </span>
          <span className="viewer-meta">
            {extOf(file.relativePath)} · {formatSize(file.size)}
          </span>
        </div>
        <div className="viewer-actions">
          {onBack ? (
            <button className="btn btn-ghost" type="button" onClick={onBack}>
              Sumário
            </button>
          ) : null}
          <a className="btn btn-ghost" href={src} target="_blank" rel="noreferrer">
            Abrir
          </a>
          <a className="btn btn-secondary" href={src} download={baseName(file.relativePath)}>
            Baixar
          </a>
        </div>
      </div>
      <FileBody file={file} />
    </>
  );
}

function MarkdownView({
  source,
  paths,
  onEvidence,
}: {
  source: string;
  paths: string[];
  onEvidence: (token: string) => void;
}) {
  return (
    <article className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 id={headingId(plainText(children))}>{children}</h1>,
          h2: ({ children }) => <h2 id={headingId(plainText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={headingId(plainText(children))}>{children}</h3>,
          code({ children, className }) {
            const text = String(children).replace(/\n$/, "");
            if (!className && resolveEvidence(text, paths)) {
              return (
                <button className="evidence" type="button" onClick={() => onEvidence(text)}>
                  {text}
                </button>
              );
            }
            return <code className={className}>{children}</code>;
          },
          a({ href, children }) {
            if (href && resolveEvidence(href, paths)) {
              return (
                <button className="evidence" type="button" onClick={() => onEvidence(href)}>
                  {children}
                </button>
              );
            }
            return <a href={href}>{children}</a>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}

export function SessionExplorer({
  top,
  command,
  plan,
  report,
  planFile,
  reportFile,
  files,
  units,
  specs,
}: {
  top: ReactNode;
  command: string;
  plan: string | null;
  report: string | null;
  planFile: FileView | null;
  reportFile: FileView | null;
  files: FileView[];
  units: UnitGroup[];
  specs: FileView[];
}) {
  const [tab, setTab] = useState<Tab>("Relatório");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const byPath = useMemo(() => new Map(files.map((file) => [file.relativePath, file])), [files]);
  const paths = useMemo(() => files.map((file) => file.relativePath), [files]);
  const current = selected ? byPath.get(selected) ?? null : null;
  const specCurrent = specs.find((file) => file.relativePath === selected) ?? specs[0] ?? null;

  function openToken(token: string) {
    const hit = resolveEvidence(token, paths);
    if (hit) setSelected(hit);
  }

  const query = search.trim().toLowerCase();
  const visibleUnits = units
    .map((unit, index) => ({
      dir: unit.dir,
      index,
      files: unit.files.filter(
        (file) =>
          !query ||
          file.relativePath.toLowerCase().includes(query) ||
          (file.caseId ?? "").toLowerCase().includes(query),
      ),
    }))
    .filter((unit) => unit.files.length > 0);

  const body = (() => {
    if (tab === "Plano") {
      return (
        <>
          <main className="session-main">
            {plan ? (
              <>
                <span className="source-label">qa_test_plan.md · markdown renderizado</span>
                <MarkdownView source={plan} paths={paths} onEvidence={openToken} />
              </>
            ) : (
              <p className="note">Esta rodada ainda não tem qa_test_plan.md.</p>
            )}
          </main>
          <aside className="session-side narrow">
            {current ? (
              <Viewer file={current} spec={false} onBack={() => setSelected(null)} />
            ) : (
              <>
                <span className="eyebrow-label">SUMÁRIO</span>
                <nav className="toc">
                  {headingsOf(plan).map((heading) => (
                    <a
                      key={`${heading.level}-${heading.text}`}
                      href={`#${headingId(heading.text)}`}
                      className={heading.level > 1 ? "sub" : undefined}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
                {planFile ? (
                  <div className="info-card">
                    <div className="info-row">
                      <span>arquivo</span>
                      <span>{baseName(planFile.relativePath)}</span>
                    </div>
                    <div className="info-row">
                      <span>tamanho</span>
                      <span>{formatSize(planFile.size)}</span>
                    </div>
                    <div className="info-row">
                      <span>tipo</span>
                      <span>{planFile.contentType}</span>
                    </div>
                  </div>
                ) : null}
                <p className="hint-card">Caminhos relativos no markdown abrem o arquivo no painel ao lado.</p>
              </>
            )}
          </aside>
        </>
      );
    }
    if (tab === "Relatório") {
      if (!report) {
        return (
          <div className="empty-state">
            <img src="/brand/icon-report-empty.svg" alt="" />
            <h2>Esta rodada ainda não tem relatório</h2>
            <p>
              qa_report.md não foi publicado e o qa_session.json não traz session.result. O plano e as evidências das
              unidades já podem ser consultados.
            </p>
            <div className="codebox">
              <span>
                <span className="prompt">$ </span>
                {command}
              </span>
              <CopyButton text={command} label="copiar" copiedLabel="copiado" className="copy-link" />
            </div>
            <p className="note">
              Quando o relatório existir, o mesmo session.id faz upsert e substitui o conjunto de arquivos.
            </p>
            <div className="actions">
              <button className="btn btn-secondary" type="button" onClick={() => setTab("Plano")}>
                Ver plano
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setTab("Unidades")}>
                Ver unidades
              </button>
            </div>
          </div>
        );
      }
      return (
        <>
          <main className="session-main">
            <span className="source-label">
              {reportFile ? baseName(reportFile.relativePath) : "qa_report.md"} · markdown renderizado
            </span>
            <MarkdownView source={report} paths={paths} onEvidence={openToken} />
          </main>
          <aside className="session-side">
            {current ? (
              <Viewer file={current} spec={false} />
            ) : (
              <p className="viewer-empty">Selecione uma evidência.</p>
            )}
          </aside>
        </>
      );
    }
    if (tab === "Unidades") {
      return (
        <>
          <main className="session-main">
            <div className="unit-toolbar">
              <input
                className="search"
                placeholder="Filtrar por caso ou arquivo  (ex.: ct-11)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="unit-count">
                {units.length} unidades · {files.length} arquivos
              </span>
            </div>
            <div className="units">
              {visibleUnits.map((unit) => {
                const open = query ? true : (toggled[unit.dir] ?? unit.index < 2);
                return (
                  <section className="unit" key={unit.dir}>
                    <button
                      className="unit-head"
                      type="button"
                      onClick={() => setToggled((state) => ({ ...state, [unit.dir]: !open }))}
                    >
                      <span className="unit-caret">{open ? "▾" : "▸"}</span>
                      <span className="unit-tag">U{unit.index + 1}</span>
                      <span>{unit.dir}</span>
                      <span className="unit-count">{unit.files.length} arquivos</span>
                    </button>
                    {open ? (
                      <div className="unit-files">
                        {unit.files.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            className={selected === file.relativePath ? "file-row on" : "file-row"}
                            onClick={() => setSelected(file.relativePath)}
                          >
                            <span className="case-chip">{file.caseId ?? "—"}</span>
                            <span className="file-name">{baseName(file.relativePath)}</span>
                            <span className="file-size">{formatSize(file.size)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </main>
          <aside className="session-side wide">
            {current ? <Viewer file={current} spec={false} /> : <p className="viewer-empty">Selecione um arquivo.</p>}
          </aside>
        </>
      );
    }
    return (
      <>
        <div className="spec-list-wrap">
          <div className="spec-head">
            <div className="spec-title-row">
              <h2>Spec</h2>
              <span className="chip-ro">somente leitura</span>
            </div>
            <p className="panel-caption">Automação efêmera desta rodada. O portal guarda e mostra; não executa.</p>
          </div>
          {specs.length === 0 ? <p className="note">Esta rodada não tem spec.</p> : null}
          <div className="spec-list">
            {specs.map((file) => (
              <button
                key={file.id}
                type="button"
                className={specCurrent?.relativePath === file.relativePath ? "file-row on" : "file-row"}
                onClick={() => setSelected(file.relativePath)}
              >
                <span className="file-name">{file.relativePath}</span>
                <span className="file-size">{formatSize(file.size)}</span>
              </button>
            ))}
          </div>
          <div className="ignored">
            <strong>NÃO PUBLICADOS PELO tfs push</strong>
            <span>spec/node_modules/</span>
            <span>spec/test-output/</span>
            <span>.playwright-artifacts*</span>
          </div>
        </div>
        <aside className="session-side fill">
          {specCurrent ? <Viewer file={specCurrent} spec /> : <p className="viewer-empty">Selecione um arquivo.</p>}
        </aside>
      </>
    );
  })();

  return (
    <>
      <header className="session-head">
        {top}
        <div className="session-tabbar">
          <div className="tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="tabs-meta">qa_session.json · {files.length} arquivos</span>
        </div>
      </header>
      <div className="session-body">{body}</div>
    </>
  );
}
