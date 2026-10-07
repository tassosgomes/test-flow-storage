import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb, closeDb } from "../db";
import { artifact, user } from "../db/schema";
import { PUT } from "../../app/api/storage/object/route";
import { handleCompleteSession, handleCreateProject, handlePushSession, newApiSecret } from "./v1";

const secret = newApiSecret();

beforeAll(async () => {
  const db = getDb();
  await db.execute(
    sql`truncate artifact, qa_session, api_key, project, account, "session", verification, "user" cascade`,
  );
  await db.insert(user).values({
    id: randomUUID(),
    name: "QA",
    email: "qa@example.test",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const owner = await db.select().from(user).where(eq(user.email, "qa@example.test"));
  const { apiKey } = await import("../db/schema");
  await db.insert(apiKey).values({
    id: randomUUID(),
    userId: owner[0].id,
    name: "teste",
    keyHash: secret.hash,
    prefix: secret.prefix,
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await closeDb();
});

function authed(url: string, body?: unknown, token = secret.secret) {
  return new Request(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function manifest(id: string, files: { path: string; text: string }[]) {
  return {
    session: {
      session: {
        id,
        started_at: "2026-10-07T13:36:17Z",
        artifact_under_test: "prd",
        result: { overall: "APPROVED", pass: 1, fail: 0, blocked: 0, not_executed: 0 },
      },
    },
    files: files.map((file) => ({
      path: file.path,
      size: Buffer.byteLength(file.text),
      sha256: createHash("sha256").update(file.text).digest("hex"),
      contentType: file.path.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
    })),
  };
}

async function putUploads(uploads: { url: string; path: string }[], files: { path: string; text: string }[]) {
  for (const upload of uploads) {
    const file = files.find((item) => item.path === upload.path);
    if (!file) throw new Error(upload.path);
    const response = await PUT(
      new Request(upload.url, {
        method: "PUT",
        headers: { "content-type": file.path.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8" },
        body: file.text,
      }),
    );
    expect(response.status).toBe(204);
  }
}

it("recusa chave inválida e substitui o conjunto no segundo push", async () => {
  const denied = await handlePushSession(authed("http://127.0.0.1:3000/api/v1/projects/lab/sessions", {}, "nope"), "lab", "http://127.0.0.1:3000");
  expect(denied.status).toBe(401);

  const created = await handleCreateProject(
    authed("http://127.0.0.1:3000/api/v1/projects", { name: "Lab", slug: "lab" }),
  );
  expect(created.status).toBe(201);

  const firstFiles = [
    { path: "qa_report.md", text: "# QA Report — CAP-001 Conta e autenticação do aluno\n" },
    { path: "b.txt", text: "b" },
  ];
  const first = await handlePushSession(
    authed("http://127.0.0.1:3000/api/v1/projects/lab/sessions", manifest("qa-lab", firstFiles)),
    "lab",
    "http://127.0.0.1:3000",
  );
  expect(first.status).toBe(200);
  const firstBody = await first.json();
  await putUploads(firstBody.uploads, firstFiles);
  const done = await handleCompleteSession(
    authed("http://127.0.0.1:3000/api/v1/projects/lab/sessions/qa-lab/complete", {}),
    "lab",
    "qa-lab",
  );
  expect(done.status).toBe(200);

  const secondFiles = [
    { path: "qa_report.md", text: "# QA Report — CAP-001 Conta e autenticação do aluno\n" },
    { path: "c.txt", text: "c" },
  ];
  const second = await handlePushSession(
    authed("http://127.0.0.1:3000/api/v1/projects/lab/sessions", manifest("qa-lab", secondFiles)),
    "lab",
    "http://127.0.0.1:3000",
  );
  const secondBody = await second.json();
  await putUploads(secondBody.uploads, secondFiles);
  await handleCompleteSession(
    authed("http://127.0.0.1:3000/api/v1/projects/lab/sessions/qa-lab/complete", {}),
    "lab",
    "qa-lab",
  );

  const db = getDb();
  const rows = await db.select().from(artifact);
  expect(rows.map((row) => row.relativePath).sort()).toEqual(["c.txt", "qa_report.md"]);
  const { qaSession } = await import("../db/schema");
  const rounds = await db.select().from(qaSession);
  expect(rounds).toHaveLength(1);
  expect(rounds[0].title).toBe("Conta e autenticação do aluno");
  expect(rounds[0].status).toBe("ready");
});
