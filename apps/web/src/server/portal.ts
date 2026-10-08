import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resultLabel, slugify } from "@tfs/schema";
import { getDb } from "../db";
import { apiKey, artifact, project, qaSession } from "../db/schema";
import { getAuth } from "../lib/auth";
import { newApiSecret } from "./v1";

export async function currentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function listProjects(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.createdAt));
  const items = await Promise.all(
    rows.map(async (item) => {
      const sessions = await db
        .select({ result: qaSession.result, startedAt: qaSession.startedAt, updatedAt: qaSession.updatedAt })
        .from(qaSession)
        .where(eq(qaSession.projectId, item.id))
        .orderBy(desc(qaSession.updatedAt));
      return {
        ...item,
        sessionCount: sessions.length,
        recentVerdicts: sessions.slice(0, 3).map((round) => resultLabel(round.result?.overall)),
        lastStartedAt: sessions[0]?.startedAt ?? null,
        lastActivity: sessions[0]?.updatedAt ?? item.createdAt,
      };
    }),
  );
  return items.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

export async function createProjectForUser(userId: string, name: string, requestedSlug?: string) {
  const slug = slugify(requestedSlug || name);
  if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Informe um nome válido." as const };
  }
  const db = getDb();
  const existing = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.slug, slug)))
    .limit(1);
  if (existing[0]) return { error: "Esse slug já existe." as const };
  await db.insert(project).values({
    id: randomUUID(),
    userId,
    name: name.trim(),
    slug,
    createdAt: new Date(),
  });
  return { slug };
}

export async function projectBySlug(userId: string, slug: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function sessionsForProject(projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(qaSession)
    .where(eq(qaSession.projectId, projectId))
    .orderBy(desc(qaSession.updatedAt));
}

export async function sessionDetail(userId: string, slug: string, externalId: string) {
  const owned = await projectBySlug(userId, slug);
  if (!owned) return null;
  const db = getDb();
  const rounds = await db
    .select()
    .from(qaSession)
    .where(and(eq(qaSession.projectId, owned.id), eq(qaSession.externalId, externalId)))
    .limit(1);
  const round = rounds[0];
  if (!round) return null;
  const files = await db.select().from(artifact).where(eq(artifact.sessionId, round.id));
  return { project: owned, round, files };
}

export async function listApiKeys(userId: string) {
  const db = getDb();
  return db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    })
    .from(apiKey)
    .where(and(eq(apiKey.userId, userId), sql`${apiKey.revokedAt} is null`))
    .orderBy(desc(apiKey.createdAt));
}

export async function createApiKeyForUser(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe um nome." as const };
  const minted = newApiSecret();
  const db = getDb();
  await db.insert(apiKey).values({
    id: randomUUID(),
    userId,
    name: trimmed,
    keyHash: minted.hash,
    prefix: minted.prefix,
    createdAt: new Date(),
  });
  return { secret: minted.secret };
}

export async function revokeApiKeyForUser(userId: string, id: string) {
  const db = getDb();
  await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.userId, userId), eq(apiKey.id, id)));
}

export async function artifactForUser(userId: string, id: string) {
  const db = getDb();
  const rows = await db
    .select({ artifact, projectUserId: project.userId })
    .from(artifact)
    .innerJoin(qaSession, eq(artifact.sessionId, qaSession.id))
    .innerJoin(project, eq(qaSession.projectId, project.id))
    .where(eq(artifact.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.projectUserId !== userId) return null;
  return row.artifact;
}
