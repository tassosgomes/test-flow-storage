import { z } from "zod";

export const sessionResultSchema = z.object({
  overall: z.string(),
  pass: z.number(),
  fail: z.number(),
  blocked: z.number(),
  not_executed: z.number(),
});

export const sessionUnitSchema = z.object({
  id: z.string(),
  dir: z.string(),
  cases: z.array(z.string()).optional(),
});

export const sessionFileSchema = z
  .object({
    session: z
      .object({
        id: z.string().min(1),
        started_at: z.string().optional(),
        artifact_under_test: z.string().optional(),
        environment: z.record(z.unknown()).optional(),
        authorization: z.string().optional(),
        completed_at: z.string().optional(),
        result: sessionResultSchema.optional(),
      })
      .passthrough(),
    units: z.array(sessionUnitSchema).optional(),
  })
  .passthrough();

export type SessionFile = z.infer<typeof sessionFileSchema>;

export const manifestFileSchema = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentType: z.string().min(1),
});

export const pushManifestSchema = z.object({
  session: sessionFileSchema,
  files: z.array(manifestFileSchema).min(1),
});

export type PushManifest = z.infer<typeof pushManifestSchema>;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  js: "text/plain; charset=utf-8",
  mjs: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  webm: "video/webm",
  mp4: "video/mp4",
  pdf: "application/pdf",
  css: "text/css; charset=utf-8",
};

export function contentTypeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function isIgnoredRelative(relativePath: string): boolean {
  return relativePath.split("/").some((part) => {
    return (
      part === "node_modules" ||
      part === "test-output" ||
      part.startsWith(".playwright-artifacts")
    );
  });
}

export function isSafeRelative(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) {
    return false;
  }
  const parts = relativePath.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export function caseIdFromPath(relativePath: string): string | null {
  const base = relativePath.split("/").pop() ?? relativePath;
  const match = base.match(/^(?:reteste-)?(ct-?\d+[a-z]?)/i);
  return match ? match[1].toUpperCase() : null;
}

export function unitFromPath(
  relativePath: string,
  unitDirs: string[] | null,
): string | null {
  const first = relativePath.split("/").filter(Boolean)[0];
  if (!first || first === "spec") return null;
  if (unitDirs && unitDirs.length > 0) {
    return unitDirs.includes(first) ? first : null;
  }
  return /^u\d+-/i.test(first) ? first : null;
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return slug || "projeto";
}

export function titleFromMarkdown(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const heading = markdown.split("\n").find((line) => line.startsWith("# "));
  if (!heading) return null;
  return heading.slice(2).trim()
    .replace(/^QA Report\s+[—–-]\s+/i, "")
    .replace(/^Relat[oó]rio de Testes QA\s+[—–-]\s+/i, "")
    .replace(/^Plano de QA\s+[—–-]\s+/i, "")
    .replace(/^CAP-\d+\s+/i, "")
    .trim();
}

export function resultLabel(overall: string | undefined | null): string {
  if (!overall) return "sem relatório";
  const value = overall.toUpperCase();
  if (value === "APPROVED" || value === "APROVADO") return "APROVADO";
  if (value === "REJECTED" || value === "REPROVADO") return "REPROVADO";
  return overall;
}
