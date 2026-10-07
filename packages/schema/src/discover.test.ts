import path from "node:path";
import { describe, expect, it } from "vitest";
import { caseIdFromPath, unitFromPath } from "./index.js";
import { discoverSessionRoots } from "./discover.js";

const evidence = path.resolve("qa-evidence");

describe("discoverSessionRoots", () => {
  const roots = discoverSessionRoots(evidence);

  it("encontra a rodada corrente e os dois arquivos", () => {
    expect(roots.map((root) => root.session.session.id).sort((left, right) => left.localeCompare(right))).toEqual([
      "qa-cap001-conta-aluno-2026-10-07",
      "qa-cap002-acesso-interno-2026-10-07",
      "qa-cap030-trilha-auditoria-2026-10-07",
    ]);
  });

  it("não sobe node_modules, test-output nem archive dentro da rodada corrente", () => {
    const current = roots.find(
      (root) => root.session.session.id === "qa-cap002-acesso-interno-2026-10-07",
    );
    expect(current).toBeTruthy();
    const paths = current!.files.map((file) => file.relativePath);
    expect(paths.some((file) => file.includes("node_modules"))).toBe(false);
    expect(paths.some((file) => file.includes("test-output"))).toBe(false);
    expect(paths.some((file) => file.startsWith("archive-"))).toBe(false);
    expect(paths).toContain("spec/helpers.ts");
    expect(paths).toContain("qa_session.json");
    expect(paths).toContain("qa_test_plan.md");
  });

  it("associa o caso e a unidade pelo caminho", () => {
    const archived = roots.find(
      (root) => root.session.session.id === "qa-cap001-conta-aluno-2026-10-07",
    );
    const shot = archived!.files.find((file) =>
      file.relativePath.endsWith("ct-01-cadastro-sucesso-confira-seu-email.png"),
    );
    expect(shot).toMatchObject({
      caseId: "CT-01",
      unit: "u1-cadastro-confirmacao",
    });
    expect(archived!.files.some((file) => file.relativePath === "qa_report.md")).toBe(true);
  });
});

describe("caseIdFromPath", () => {
  it("reconhece os prefixos da skill", () => {
    expect(caseIdFromPath("u1/ct-01-ok.png")).toBe("CT-01");
    expect(caseIdFromPath("ct01.json")).toBe("CT01");
    expect(caseIdFromPath("u3/reteste-ct-06-confirmado.png")).toBe("CT-06");
    expect(caseIdFromPath("u2/ct15_B.json")).toBe("CT15");
    expect(caseIdFromPath("u4/evidencia/ct-22b-concessao-f1.json")).toBe("CT-22B");
    expect(caseIdFromPath("qa_report.md")).toBeNull();
  });

  it("usa units[].dir quando a sessão declara as unidades", () => {
    expect(unitFromPath("u1-cadastro-confirmacao/ct-01.png", ["u1-cadastro-confirmacao"])).toBe(
      "u1-cadastro-confirmacao",
    );
    expect(unitFromPath("spec/helpers.ts", ["u1-cadastro-confirmacao"])).toBeNull();
    expect(unitFromPath("u2-login-sessao/ct-10.png", null)).toBe("u2-login-sessao");
  });
});
