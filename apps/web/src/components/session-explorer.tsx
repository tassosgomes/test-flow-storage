"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatSize } from "@/lib/format";

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

function FileBody({ file }: { file: FileView }) {
  const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
  const src = `/api/portal/artifacts/${file.id}`;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return <img src={src} alt={file.relativePath} />;
  }
  if (["webm", "mp4"].includes(ext)) {
    return <video src={src} controls />;
  }
  return <TextBody id={file.id} json={ext === "json"} />;
}

function TextBody({ id, json }: { id: string; json: boolean }) {
  const [text, setText] = useState("…");
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
  return <pre>{text}</pre>;
}

export function SessionExplorer({
  plan,
  report,
  files,
  units,
  specs,
}: {
  plan: string | null;
  report: string | null;
  files: FileView[];
  units: UnitGroup[];
  specs: FileView[];
}) {
  const [tab, setTab] = useState<Tab>(report ? "Relatório" : "Plano");
  const [selected, setSelected] = useState<string | null>(null);
  const byPath = useMemo(() => new Map(files.map((file) => [file.relativePath, file])), [files]);
  const paths = useMemo(() => files.map((file) => file.relativePath), [files]);
  const current = selected ? byPath.get(selected) ?? null : null;

  function openToken(token: string) {
    const hit = resolveEvidence(token, paths);
    if (hit) setSelected(hit);
  }

  const markdown = tab === "Plano" ? plan : tab === "Relatório" ? report : null;

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className={tab === "Spec" ? "" : "work"}>
        <div>
          {tab === "Relatório" && !report ? <p>Esta rodada ainda não tem qa_report.md.</p> : null}
          {tab === "Plano" && !plan ? <p>Esta rodada ainda não tem qa_test_plan.md.</p> : null}
          {markdown ? (
            <article className="markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ children, className }) {
                    const text = String(children).replace(/\n$/, "");
                    if (!className && resolveEvidence(text, paths)) {
                      return (
                        <button className="evidence" type="button" onClick={() => openToken(text)}>
                          {text}
                        </button>
                      );
                    }
                    return <code className={className}>{children}</code>;
                  },
                  a({ href, children }) {
                    if (href && resolveEvidence(href, paths)) {
                      return (
                        <button className="evidence" type="button" onClick={() => openToken(href)}>
                          {children}
                        </button>
                      );
                    }
                    return <a href={href}>{children}</a>;
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </article>
          ) : null}
          {tab === "Unidades"
            ? units.map((unit) => (
                <section className="unit" key={unit.dir}>
                  <h2>{unit.dir}</h2>
                  {unit.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      className={selected === file.relativePath ? "file-row on" : "file-row"}
                      onClick={() => setSelected(file.relativePath)}
                    >
                      <span className="case">{file.caseId ?? "—"}</span>
                      <span>{file.relativePath.split("/").pop()}</span>
                    </button>
                  ))}
                </section>
              ))
            : null}
          {tab === "Spec" ? (
            <div>
              <p className="muted">Spec — automação efêmera desta rodada</p>
              {specs.length === 0 ? <p>Esta rodada não tem spec.</p> : null}
              <ul className="spec-list">
                {specs.map((file) => (
                  <li key={file.id}>
                    <button className="evidence" type="button" onClick={() => setSelected(file.relativePath)}>
                      {file.relativePath}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {tab === "Spec" ? null : (
          <aside className="viewer">
            {current ? (
              <>
                <strong>{current.relativePath.split("/").pop()}</strong>
                <p className="muted">
                  {current.unit || "raiz"}
                  {" · "}
                  {current.relativePath.split(".").pop()} · {formatSize(current.size)}
                </p>
                <FileBody file={current} />
              </>
            ) : (
              <p className="muted">Selecione uma evidência.</p>
            )}
          </aside>
        )}
      </div>
      {tab === "Spec" && current ? (
        <aside className="viewer">
          <strong>{current.relativePath}</strong>
          <FileBody file={current} />
        </aside>
      ) : null}
    </div>
  );
}
