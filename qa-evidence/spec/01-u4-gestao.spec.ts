// U4 — Conceder, revogar e trocar papel (RF-06 a RF-09, RF-12).
// Ordem serial preserva a máquina de estados de E1/F1/S1 (ver qa_test_plan.md).
import { test, expect } from '@playwright/test';
import {
  ADMIN,
  STAFF,
  evidencia,
  loginStaff,
  currentSession,
  apiCall,
  memberByEmail,
  openAction,
} from './helpers';

async function waitJson(page: any, urlPart: RegExp) {
  const resp = await page.waitForResponse(
    (r: any) => urlPart.test(r.url()) && r.request().method() === 'POST',
    { timeout: 20000 },
  );
  const body = await resp.json().catch(() => null);
  return { status: resp.status(), body };
}

test('CT-23 conceder papel ja detido nao muda nada', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  const e1 = await memberByEmail(page, STAFF.professor.email);
  const session = await currentSession(page);
  const res = await apiCall(
    page,
    'POST',
    `/api/v1/staff-members/${e1.accountId}/role-grants`,
    session.body.csrfToken,
    { role: 'suporte', reason: 'QA-CAP002-CT23 concessao repetida do papel suporte' },
  );
  evidencia('u4-papeis', 'ct-23-resposta.json', res);
  expect(res.status).toBe(200);
  expect(res.body.changed).toBe(false);
  const after = await memberByEmail(page, STAFF.professor.email);
  expect(after.roles.sort()).toEqual(['professor', 'suporte']);
});

test('CT-24 propria conta sem acoes e concessao a si recusada', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/acessos');
  await expect(page.getByRole('heading', { name: 'Equipe e papéis' })).toBeVisible({
    timeout: 15000,
  });
  // Linha marcada "você" (isSelf) não oferece ações; as demais linhas oferecem.
  await expect(page.getByText('você', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ações para Backoffice administrator' }),
  ).toHaveCount(0);
  expect(await page.getByRole('button', { name: /Ações para/ }).count()).toBeGreaterThan(0);
  await page.screenshot({
    path: '../u4-papeis/evidencia/ct-24-linha-propria.png',
  });

  // Chamada direta: conceder papel à própria conta é recusada (RN-20).
  const session = await currentSession(page);
  const selfId = session.body.accountId as string;
  expect(selfId).toBeTruthy();
  const res = await apiCall(page, 'POST', `/api/v1/staff-members/${selfId}/role-grants`, session.body.csrfToken, {
    role: 'suporte',
    reason: 'QA-CAP002-CT24 tentativa de auto-concessao',
  });
  evidencia('u4-papeis', 'ct-24-auto-concessao.json', res);
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.body.changed ?? null).not.toBe(true);
  const members = await memberByEmail(page, ADMIN.email);
  expect(members.roles).toEqual(['administrador']);
});

test('CT-25 nao-admin por link direto e chamada direta recusados', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginStaff(admin, ADMIN.email, ADMIN.password);
  const s1 = await memberByEmail(admin, STAFF.suporte.email);
  await adminCtx.close();

  const e1Ctx = await browser.newContext();
  const page = await e1Ctx.newPage();
  try {
    await loginStaff(page, STAFF.professor.email, STAFF.professor.password);
    // Link direto à gestão.
    await page.goto('/admin/acessos');
    await page.waitForTimeout(3000);
    const listRes = await page.evaluate(async () => {
      const r = await fetch('/api/v1/staff-members?page=1&size=100', {
        headers: { Accept: 'application/json' },
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    });
    evidencia('u4-papeis', 'ct-25-lista-recusada.json', listRes);
    expect(listRes.status).toBe(403);
    expect(listRes.body.code).toBe('PERMISSION_DENIED');
    await page.screenshot({ path: '../u4-papeis/evidencia/ct-25-e1-gestao.png' });

    // Chamada direta de concessão com sessão de não-admin, sobre conta real.
    const session = await currentSession(page);
    const res = await apiCall(
      page,
      'POST',
      `/api/v1/staff-members/${s1.accountId}/role-grants`,
      session.body.csrfToken,
      { role: 'financeiro', reason: 'QA-CAP002-CT25 tentativa de nao-admin' },
    );
    evidencia('u4-papeis', 'ct-25-concessao-recusada.json', res);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  } finally {
    await e1Ctx.close();
  }
});

test('CT-27 revogacao encerra sessoes e vale na reentrada', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const e1Ctx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const e1 = await e1Ctx.newPage();
  try {
    await loginStaff(e1, STAFF.professor.email, STAFF.professor.password);
    await e1.goto('/admin/');
    await expect(e1.getByText('suporte')).toBeVisible({ timeout: 10000 });

    await loginStaff(admin, ADMIN.email, ADMIN.password);
    const dialog = await openAction(admin, STAFF.professor.name, 'Revogar papel');
    await expect(dialog.getByText('A pessoa será desconectada agora.')).toBeVisible();
    await dialog.getByRole('combobox', { name: /Papel para/ }).selectOption('suporte');
    await dialog.getByRole('textbox', { name: /Motivo/ }).fill(
      'QA-CAP002-CT27 revogacao suporte de professor em atividade',
    );
    const pending = waitJson(admin, /role-revocations/);
    await dialog.getByRole('button', { name: 'Revogar papel', exact: true }).click();
    const res = await pending;
    evidencia('u4-papeis', 'ct-27-revogacao.json', res);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(res.body.sessionsEnded).toBe(true);
    await expect(dialog).toBeHidden({ timeout: 10000 });
    await admin.screenshot({ path: '../u4-papeis/evidencia/ct-27-lista-apos.png' });

    // Próxima ação do ator: sessão encerrada.
    await e1.goto('/admin/');
    await e1.waitForURL(/\/admin\/entrar/, { timeout: 15000 });
    const sess = await currentSession(e1);
    expect(sess.status).toBe(401);

    // Reentrada: só com as permissões de professor.
    await loginStaff(e1, STAFF.professor.email, STAFF.professor.password);
    await expect(e1.getByText('Seus papéis:')).toBeVisible({ timeout: 10000 });
    const rolesText = await e1.getByText('Seus papéis:').locator('..').innerText();
    expect(rolesText).toContain('professor');
    expect(rolesText).not.toContain('suporte');
    await e1.screenshot({ path: '../u4-papeis/evidencia/ct-27-reentrada-professor.png' });
  } finally {
    await adminCtx.close();
    await e1Ctx.close();
  }
});

test('CT-28 revogar papel nao detido nao muda nada', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  const e1 = await memberByEmail(page, STAFF.professor.email);
  expect(e1.roles).toEqual(['professor']);
  const session = await currentSession(page);
  const res = await apiCall(
    page,
    'POST',
    `/api/v1/staff-members/${e1.accountId}/role-revocations`,
    session.body.csrfToken,
    { role: 'financeiro', reason: 'QA-CAP002-CT28 revogacao de papel nao detido' },
  );
  evidencia('u4-papeis', 'ct-28-resposta.json', res);
  expect(res.status).toBe(200);
  expect(res.body.changed).toBe(false);
  const after = await memberByEmail(page, STAFF.professor.email);
  expect(after.roles).toEqual(['professor']);
});

test('CT-22b concessao a F1 com motivo vale na lista', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  const dialog = await openAction(page, STAFF.financeiro.name, 'Conceder papel');
  await dialog.getByRole('combobox', { name: /Papel para/ }).selectOption('suporte');
  await dialog.getByRole('textbox', { name: /Motivo/ }).fill(
    'QA-CAP002-CT22B ampliar atuacao financeiro para atendimento',
  );
  const pending = waitJson(page, /role-grants/);
  await dialog.getByRole('button', { name: 'Conceder papel', exact: true }).click();
  const res = await pending;
  evidencia('u4-papeis', 'ct-22b-concessao-f1.json', res);
  expect(res.status).toBe(200);
  expect(res.body.changed).toBe(true);
  await expect(dialog).toBeHidden({ timeout: 10000 });
  const after = await memberByEmail(page, STAFF.financeiro.email);
  expect(after.roles.sort()).toEqual(['financeiro', 'suporte']);
});

test('CT-31 troca para papel ja detido equivale a revogar a origem', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  const f1 = await memberByEmail(page, STAFF.financeiro.email);
  expect(f1.roles.sort()).toEqual(['financeiro', 'suporte']);
  const session = await currentSession(page);
  const res = await apiCall(
    page,
    'POST',
    `/api/v1/staff-members/${f1.accountId}/role-changes`,
    session.body.csrfToken,
    {
      fromRole: 'financeiro',
      toRole: 'suporte',
      reason: 'QA-CAP002-CT31 troca para papel ja detido',
    },
  );
  evidencia('u4-papeis', 'ct-31-resposta.json', res);
  expect(res.status).toBe(200);
  expect(res.body.changed).toBe(true);
  const after = await memberByEmail(page, STAFF.financeiro.email);
  expect(after.roles).toEqual(['suporte']);
});

test('CT-30 troca suporte por financeiro numa acao desconecta o ator', async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const s1Ctx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const s1 = await s1Ctx.newPage();
  try {
    await loginStaff(s1, STAFF.suporte.email, STAFF.suporte.password);
    await s1.goto('/admin/');
    await expect(s1.getByText('suporte')).toBeVisible({ timeout: 10000 });

    await loginStaff(admin, ADMIN.email, ADMIN.password);
    const dialog = await openAction(admin, STAFF.suporte.name, 'Trocar papel');
    await expect(dialog.getByText('A pessoa será desconectada agora.')).toBeVisible();
    await dialog.getByRole('combobox', { name: /Papel atual/ }).selectOption('suporte');
    await dialog.getByRole('combobox', { name: /Novo papel/ }).selectOption('financeiro');
    await dialog.getByRole('textbox', { name: /Motivo/ }).fill(
      'QA-CAP002-CT30 troca suporte por financeiro em ato unico',
    );
    const pending = waitJson(admin, /role-changes/);
    await dialog.getByRole('button', { name: 'Trocar papel', exact: true }).click();
    const res = await pending;
    evidencia('u4-papeis', 'ct-30-troca.json', res);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(res.body.sessionsEnded).toBe(true);
    expect(res.body.member.roles).toEqual(['financeiro']);
    await expect(dialog).toBeHidden({ timeout: 10000 });

    await s1.goto('/admin/');
    await s1.waitForURL(/\/admin\/entrar/, { timeout: 15000 });
    const sess = await currentSession(s1);
    expect(sess.status).toBe(401);
  } finally {
    await adminCtx.close();
    await s1Ctx.close();
  }
});

test('CT-21 financeiro revogado com sessao aberta tem proxima acao recusada', async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const s1Ctx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const s1 = await s1Ctx.newPage();
  try {
    await loginStaff(s1, STAFF.suporte.email, STAFF.suporte.password);
    await s1.goto('/admin/financeiro');
    await expect(s1.getByRole('heading', { name: 'Pedidos' })).toBeVisible({
      timeout: 15000,
    });

    await loginStaff(admin, ADMIN.email, ADMIN.password);
    const dialog = await openAction(admin, STAFF.suporte.name, 'Revogar papel');
    await dialog.getByRole('combobox', { name: /Papel para/ }).selectOption('financeiro');
    await dialog.getByRole('textbox', { name: /Motivo/ }).fill(
      'QA-CAP002-CT21 revogacao financeiro com sessao aberta na area',
    );
    const pending = waitJson(admin, /role-revocations/);
    await dialog.getByRole('button', { name: 'Revogar papel', exact: true }).click();
    const res = await pending;
    evidencia('u3-menor-privilegio', 'ct-21-revogacao.json', res);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);

    // Próxima ação na área financeira é recusada sem esperar expiração.
    await s1.goto('/admin/financeiro');
    await s1.waitForTimeout(3000);
    await expect(s1.getByRole('heading', { name: 'Pedidos' })).toHaveCount(0);
    const sess = await currentSession(s1);
    expect(sess.status).toBe(401);
    await s1.screenshot({ path: '../u3-menor-privilegio/evidencia/ct-21-acao-recusada.png' });
    evidencia('u3-menor-privilegio', 'ct-21-url-apos.txt', s1.url());
  } finally {
    await adminCtx.close();
    await s1Ctx.close();
  }
});

test('CT-29 conta sem papel ve mensagem de sem acesso e volta com novo papel', async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const s1Ctx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const s1 = await s1Ctx.newPage();
  try {
    // S1 teve o último papel revogado em CT-21.
    await loginStaff(admin, ADMIN.email, ADMIN.password);
    const check = await memberByEmail(admin, STAFF.suporte.email);
    expect(check.roles).toEqual([]);

    await loginStaff(s1, STAFF.suporte.email, STAFF.suporte.password);
    const homeText = await s1.locator('main').innerText();
    evidencia('u4-papeis', 'ct-29-inicio-sem-papel.txt', homeText);
    expect(homeText).toMatch(/sem acesso|nenhum|procur|administrador/i);
    for (const area of ['autoria', 'videos', 'financeiro', 'acessos', 'catalogo', 'auditoria']) {
      await expect(s1.locator(`a[href="/admin/${area}"]`)).toHaveCount(0);
    }
    await s1.screenshot({ path: '../u4-papeis/evidencia/ct-29-sem-acesso.png' });

    const dialog = await openAction(admin, STAFF.suporte.name, 'Conceder papel');
    await dialog.getByRole('combobox', { name: /Papel para/ }).selectOption('financeiro');
    await dialog.getByRole('textbox', { name: /Motivo/ }).fill(
      'QA-CAP002-CT29 devolver acesso financeiro apos revogacao total',
    );
    const pending = waitJson(admin, /role-grants/);
    await dialog.getByRole('button', { name: 'Conceder papel', exact: true }).click();
    const res = await pending;
    evidencia('u4-papeis', 'ct-29-nova-concessao.json', res);
    expect(res.body.changed).toBe(true);

    await loginStaff(s1, STAFF.suporte.email, STAFF.suporte.password);
    await s1.goto('/admin/financeiro');
    await expect(s1.getByRole('heading', { name: 'Pedidos' })).toBeVisible({
      timeout: 15000,
    });
  } finally {
    await adminCtx.close();
    await s1Ctx.close();
  }
});
