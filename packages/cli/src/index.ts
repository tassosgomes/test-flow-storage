#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { discoverSessionRoots, type DiscoveredFile } from "@tfs/schema/discover";

type Project = { name: string; slug: string; sessionCount: number };

function config() {
  const baseUrl = (process.env.TFS_API_URL || "http://localhost:3000").replace(/\/$/, "");
  const apiKey = process.env.TFS_API_KEY;
  if (!apiKey) {
    throw new Error("Defina TFS_API_KEY com uma chave criada no portal.");
  }
  return { baseUrl, apiKey };
}

async function api(pathname: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.error || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }
  return body;
}

async function sha256(filePath: string) {
  const data = await readFile(filePath);
  return { data, sha256: createHash("sha256").update(data).digest("hex") };
}

async function uploadFiles(
  rootDir: string,
  files: DiscoveredFile[],
  uploads: { path: string; url: string }[],
) {
  const byPath = new Map(uploads.map((upload) => [upload.path, upload.url]));
  const queue = [...files];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) return;
      const url = byPath.get(file.relativePath);
      if (!url) throw new Error(`URL de upload ausente para ${file.relativePath}`);
      const { data } = await sha256(path.join(rootDir, file.relativePath));
      const response = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.contentType },
        body: data,
      });
      if (!response.ok) {
        throw new Error(`Falha ao enviar ${file.relativePath}: ${response.status}`);
      }
    }
  });
  await Promise.all(workers);
}

async function pushDir(dir: string, project: string) {
  const sessions = discoverSessionRoots(dir);
  if (sessions.length === 0) {
    throw new Error(`Nenhuma qa_session.json em ${dir}`);
  }
  console.log(`Publicando ${sessions.length} rodada(s) em ${project}`);
  for (const session of sessions) {
    const hashed = await Promise.all(
      session.files.map(async (file) => {
        const { sha256: digest } = await sha256(path.join(session.rootDir, file.relativePath));
        return {
          path: file.relativePath,
          size: file.size,
          sha256: digest,
          contentType: file.contentType,
        };
      }),
    );
    const created = await api(`/api/v1/projects/${encodeURIComponent(project)}/sessions`, {
      method: "POST",
      body: JSON.stringify({ session: session.session, files: hashed }),
    });
    await uploadFiles(session.rootDir, session.files, created.uploads);
    await api(
      `/api/v1/projects/${encodeURIComponent(project)}/sessions/${encodeURIComponent(session.session.session.id)}/complete`,
      { method: "POST", body: JSON.stringify({}) },
    );
    console.log(`${session.session.session.id} — ${session.files.length} arquivos`);
  }
}

const program = new Command();
program.name("tfs").description("Publica planos e evidências QA");

const project = program.command("project").description("Projetos da conta");

project
  .command("list")
  .description("Lista os projetos")
  .action(async () => {
    const body = (await api("/api/v1/projects")) as { projects: Project[] };
    if (body.projects.length === 0) {
      console.log("Nenhum projeto.");
      return;
    }
    for (const item of body.projects) {
      console.log(`${item.slug}\t${item.sessionCount} rodadas\t${item.name}`);
    }
  });

project
  .command("create")
  .argument("<name>", "nome do projeto")
  .option("-s, --slug <slug>", "slug")
  .description("Cria um projeto")
  .action(async (name: string, options: { slug?: string }) => {
    const body = await api("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name, slug: options.slug }),
    });
    console.log(body.project.slug);
  });

program
  .command("push")
  .argument("<dir>", "pasta qa-evidence")
  .requiredOption("-p, --project <slug>", "slug do projeto")
  .description("Envia a rodada corrente e cada archive-*")
  .action(async (dir: string, options: { project: string }) => {
    await pushDir(dir, options.project);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
