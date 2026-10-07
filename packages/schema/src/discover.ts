import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  caseIdFromPath,
  contentTypeFor,
  isIgnoredRelative,
  sessionFileSchema,
  unitFromPath,
  type SessionFile,
} from "./index.js";

export type DiscoveredFile = {
  relativePath: string;
  size: number;
  contentType: string;
  caseId: string | null;
  unit: string | null;
};

export type DiscoveredSession = {
  rootDir: string;
  session: SessionFile;
  files: DiscoveredFile[];
};

function listRelativeFiles(rootDir: string, excludeArchives: boolean): string[] {
  const files: string[] = [];

  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (
        excludeArchives &&
        current === rootDir &&
        entry.isDirectory() &&
        entry.name.startsWith("archive-")
      ) {
        continue;
      }
      const full = path.join(current, entry.name);
      const relativePath = path.relative(rootDir, full).split(path.sep).join("/");
      if (isIgnoredRelative(relativePath)) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile()) files.push(relativePath);
    }
  };

  walk(rootDir);
  return files.sort();
}

export function discoverSessionRoots(dir: string): DiscoveredSession[] {
  const abs = path.resolve(dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`Diretório não encontrado: ${dir}`);
  }

  const roots: { dir: string; excludeArchives: boolean }[] = [];
  if (existsSync(path.join(abs, "qa_session.json"))) {
    roots.push({ dir: abs, excludeArchives: true });
  }

  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("archive-")) continue;
    const child = path.join(abs, entry.name);
    if (existsSync(path.join(child, "qa_session.json"))) {
      roots.push({ dir: child, excludeArchives: false });
    }
  }

  return roots.map((root) => {
    const raw = JSON.parse(readFileSync(path.join(root.dir, "qa_session.json"), "utf8"));
    const session = sessionFileSchema.parse(raw);
    const unitDirs = session.units?.map((unit) => unit.dir) ?? null;
    const files = listRelativeFiles(root.dir, root.excludeArchives).map((relativePath) => {
      const full = path.join(root.dir, relativePath);
      return {
        relativePath,
        size: statSync(full).size,
        contentType: contentTypeFor(relativePath),
        caseId: caseIdFromPath(relativePath),
        unit: unitFromPath(relativePath, unitDirs),
      };
    });
    return { rootDir: root.dir, session, files };
  });
}
