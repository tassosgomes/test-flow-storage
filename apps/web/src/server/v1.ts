import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  isIgnoredRelative,
  isSafeRelative,
  pushManifestSchema,
  slugify,
  titleFromMarkdown,
  unitFromPath,
  caseIdFromPath,
} from "@tfs/schema";
import { getDb } from "../db";
import { apiKey, artifact, project, qaSession } from "../db/schema";
import { getStore, objectKey } from "../lib/storage";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sameHash(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateApiKey(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.keyHash, hashKey(token)))
    .limit(1);
  const key = rows[0];
  if (!key || key.revokedAt || !sameHash(key.keyHash, hashKey(token))) return null;
  await db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, key.id));
  return key;
}

export async function handleListProjects(request: Request) {
  const key = await authenticateApiKey(request);
  if (!key) return json({ error: "unauthorized" }, 401);
  const db = getDb();
  const rows = await db.select().from(project).where(eq(project.userId, key.userId));
  const projects = await Promise.all(
    rows.map(async (item) => {
      const [count] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(qaSession)
        .where(eq(qaSession.projectId, item.id));
      return { name: item.name, slug: item.slug, sessionCount: count?.value ?? 0 };
    }),
  );
  return json({ projects });
}

export async function handleCreateProject(request: Request) {
  const key = await authenticateApiKey(request);
  if (!key) return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return json({ error: "name_required" }, 400);
  const slug = slugify(typeof body?.slug === "string" && body.slug ? body.slug : name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error: "invalid_slug" }, 400);
  const db = getDb();
  const existing = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, key.userId), eq(project.slug, slug)))
    .limit(1);
  if (existing[0]) return json({ error: "slug_taken" }, 409);
  const created = {
    id: randomUUID(),
    userId: key.userId,
    name,
    slug,
    createdAt: new Date(),
  };
  await db.insert(project).values(created);
  return json({ project: { name: created.name, slug: created.slug, sessionCount: 0 } }, 201);
}

export async function handlePushSession(request: Request, slug: string, origin: string) {
  const key = await authenticateApiKey(request);
  if (!key) return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  const parsed = pushManifestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_manifest" }, 400);
  const db = getDb();
  const projects = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, key.userId), eq(project.slug, slug)))
    .limit(1);
  const owned = projects[0];
  if (!owned) return json({ error: "not_found" }, 404);

  const sessionFile = parsed.data.session;
  const unitDirs = sessionFile.units?.map((unit) => unit.dir) ?? null;
  const externalId = sessionFile.session.id;
  for (const file of parsed.data.files) {
    if (!isSafeRelative(file.path) || isIgnoredRelative(file.path)) {
      return json({ error: "invalid_path", path: file.path }, 400);
    }
  }

  const now = new Date();
  const existing = await db
    .select()
    .from(qaSession)
    .where(and(eq(qaSession.projectId, owned.id), eq(qaSession.externalId, externalId)))
    .limit(1);

  const sessionId = existing[0]?.id ?? randomUUID();
  const values = {
    projectId: owned.id,
    externalId,
    startedAt: sessionFile.session.started_at ?? null,
    artifactUnderTest: sessionFile.session.artifact_under_test ?? null,
    title: existing[0]?.title ?? null,
    environment: sessionFile.session.environment ?? null,
    result: sessionFile.session.result ?? null,
    authorization: sessionFile.session.authorization ?? null,
    units: sessionFile.units ?? null,
    pendingPaths: parsed.data.files.map((file) => file.path),
    status: "uploading",
    updatedAt: now,
  };

  if (existing[0]) {
    await db.update(qaSession).set(values).where(eq(qaSession.id, sessionId));
  } else {
    await db.insert(qaSession).values({ ...values, id: sessionId, createdAt: now });
  }

  const store = getStore();
  const uploads = [];
  for (const file of parsed.data.files) {
    const keyPath = objectKey(owned.id, externalId, file.path);
    const current = await db
      .select()
      .from(artifact)
      .where(and(eq(artifact.sessionId, sessionId), eq(artifact.relativePath, file.path)))
      .limit(1);
    if (current[0]) {
      await db
        .update(artifact)
        .set({
          r2Key: keyPath,
          size: file.size,
          sha256: file.sha256,
          contentType: file.contentType,
          caseId: caseIdFromPath(file.path),
          unit: unitFromPath(file.path, unitDirs),
        })
        .where(eq(artifact.id, current[0].id));
    } else {
      await db.insert(artifact).values({
        id: randomUUID(),
        sessionId,
        relativePath: file.path,
        r2Key: keyPath,
        size: file.size,
        sha256: file.sha256,
        contentType: file.contentType,
        caseId: caseIdFromPath(file.path),
        unit: unitFromPath(file.path, unitDirs),
        createdAt: now,
      });
    }
    uploads.push({
      path: file.path,
      key: keyPath,
      url: await store.presignPut(keyPath, file.contentType, origin),
    });
  }

  return json({ id: externalId, uploads });
}

export async function handleCompleteSession(request: Request, slug: string, externalId: string) {
  const key = await authenticateApiKey(request);
  if (!key) return json({ error: "unauthorized" }, 401);
  const db = getDb();
  const projects = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, key.userId), eq(project.slug, slug)))
    .limit(1);
  const owned = projects[0];
  if (!owned) return json({ error: "not_found" }, 404);
  const sessions = await db
    .select()
    .from(qaSession)
    .where(and(eq(qaSession.projectId, owned.id), eq(qaSession.externalId, externalId)))
    .limit(1);
  const round = sessions[0];
  if (!round) return json({ error: "not_found" }, 404);

  const keep = new Set(round.pendingPaths);
  const files = await db.select().from(artifact).where(eq(artifact.sessionId, round.id));
  const store = getStore();
  for (const file of files) {
    if (keep.has(file.relativePath)) continue;
    await store.delete(file.r2Key);
    await db.delete(artifact).where(eq(artifact.id, file.id));
  }

  const report = files.find((file) => file.relativePath === "qa_report.md" && keep.has(file.relativePath));
  const plan = files.find((file) => file.relativePath === "qa_test_plan.md" && keep.has(file.relativePath));
  const reportText = report ? (await store.get(report.r2Key))?.toString("utf8") : null;
  const planText = plan ? (await store.get(plan.r2Key))?.toString("utf8") : null;
  const title = titleFromMarkdown(reportText) || titleFromMarkdown(planText) || round.title;

  await db
    .update(qaSession)
    .set({ status: "ready", title, updatedAt: new Date() })
    .where(eq(qaSession.id, round.id));

  return json({ id: externalId, status: "ready", files: keep.size });
}

export function newApiSecret() {
  const secret = `tfs_${randomBytes(24).toString("base64url")}`;
  return { secret, hash: hashKey(secret), prefix: secret.slice(0, 12) };
}
