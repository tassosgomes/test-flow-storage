// Helpers da rodada qa-cap002-acesso-interno-2026-10-07 (automação efêmera).
// Credenciais do admin vêm de variáveis de ambiente; nunca gravadas em arquivo.
import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const ADMIN = {
  email: process.env.QA_ADMIN_EMAIL ?? '',
  password: process.env.QA_ADMIN_PASSWORD ?? '',
};

export const STAFF = {
  professor: {
    email: 'qa.cap002.professor@example.test',
    password: 'Prof@Qa2026',
    name: 'Qa Cap002 Professor',
  },
  financeiro: {
    email: 'qa.cap002.financeiro@example.test',
    password: 'Fin@Qa2026',
    name: 'Qa Cap002 Financeiro',
  },
  suporte: {
    email: 'qa.cap002.suporte@example.test',
    password: 'Sup@Qa2026',
    name: 'Qa Cap002 Suporte',
  },
};

export const STUDENT = {
  email: 'qa.cap002.aluno@example.test',
  password: 'Aluno@Qa2026',
};

export function evidencia(unitDir: string, filename: string, content: string | object) {
  const dir = path.resolve(__dirname, '..', unitDir, 'evidencia');
  fs.mkdirSync(dir, { recursive: true });
  const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  fs.writeFileSync(path.join(dir, filename), body);
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function loginStaff(page: Page, email: string, password: string) {
  await page.goto('/admin/entrar');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin\/(?!entrar|recuperar|redefinir|convite)/, { timeout: 20000 });
}

export interface SessionInfo {
  status: number;
  body: any;
}

// Lê a sessão vigente no contexto da página (cookies + origem reais do navegador).
export async function currentSession(page: Page): Promise<SessionInfo> {
  return page.evaluate(async () => {
    const r = await fetch('/api/v1/staff-sessions/current', {
      headers: { Accept: 'application/json' },
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  });
}

export interface ApiCall {
  status: number;
  body: any;
}

// Chamada direta autenticada no contexto da página: inclui cookies, origem e CSRF.
export async function apiCall(
  page: Page,
  method: string,
  path: string,
  csrfToken: string,
  payload?: object,
): Promise<ApiCall> {
  return page.evaluate(
    async ({ method, path, csrfToken, payload }) => {
      const r = await fetch(path, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'idempotency-key': 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
            /[xy]/g,
            (c) => {
              const n = (Math.random() * 16) | 0;
              return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16);
            },
          ),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const text = await r.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* mantém texto */
      }
      return { status: r.status, body };
    },
    { method, path, csrfToken, payload },
  );
}

export async function memberByEmail(page: Page, email: string): Promise<any> {
  const res = await page.evaluate(async (email) => {
    const r = await fetch('/api/v1/staff-members?page=1&size=100', {
      headers: { Accept: 'application/json' },
    });
    const body = await r.json();
    return { status: r.status, body };
  }, email);
  expect(res.status).toBe(200);
  const members = res.body.data ?? res.body.members ?? res.body.items ?? [];
  const found = members.find((m: any) => m.email === email);
  expect(found, `membro ${email} listado`).toBeTruthy();
  return found;
}

// Abre o menu "Ações para {nome}" e clica na ação; devolve o diálogo.
export async function openAction(page: Page, personName: string, action: string) {
  await page.goto('/admin/acessos');
  await expect(page.getByRole('heading', { name: 'Equipe e papéis' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: `Ações para ${personName}` }).click();
  await page.getByRole('button', { name: action, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}
