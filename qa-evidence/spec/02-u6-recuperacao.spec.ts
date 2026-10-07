// U6 — Recuperação de senha do ator interno (RF-11).
// Executa após U4. CT-37 troca a senha de E1 para Prof@Qa2027 (resíduo declarado).
import { test, expect, APIRequestContext } from '@playwright/test';
import { STAFF, STUDENT, evidencia, loginStaff, currentSession } from './helpers';

const SMTP = 'https://smtp.tasso.dev.br';

async function smtpLatest(request: APIRequestContext, to: string) {
  const auth = Buffer.from(
    `${process.env.QA_SMTP_USER ?? ''}:${process.env.QA_SMTP_PASS ?? ''}`,
  ).toString('base64');
  const r = await request.get(`${SMTP}/api/messages?limit=10`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  expect(r.ok()).toBeTruthy();
  const body = await r.json();
  return (body.results ?? []).filter((m: any) => (m.to ?? []).includes(to));
}

async function smtpHtml(request: APIRequestContext, id: string) {
  const auth = Buffer.from(
    `${process.env.QA_SMTP_USER ?? ''}:${process.env.QA_SMTP_PASS ?? ''}`,
  ).toString('base64');
  const r = await request.get(`${SMTP}/api/messages/${id}/html`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  expect(r.ok()).toBeTruthy();
  return r.text();
}

function extractToken(html: string): string {
  const m = html.match(/\/admin\/redefinir-senha\?token=([A-Za-z0-9_-]+)/);
  expect(m, 'link de redefinição do backoffice no e-mail').toBeTruthy();
  return m![1];
}

test('CT-35 pedido com conta interna responde neutro e envia e-mail', async ({
  page,
  request,
}) => {
  await page.goto('/admin/recuperar-senha');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(STAFF.professor.email);
  await page.getByRole('button', { name: 'Enviar instruções' }).click();
  await page.waitForTimeout(2000);
  const neutral = await page.locator('main').innerText();
  evidencia('u6-recuperacao', 'ct-35-resposta-neutra.txt', neutral);
  await page.screenshot({ path: '../u6-recuperacao/evidencia/ct-35-resposta.png' });

  await page.waitForTimeout(4000);
  const msgs = await smtpLatest(request, STAFF.professor.email);
  expect(msgs.length).toBeGreaterThan(0);
  const latest = msgs[0];
  evidencia('u6-recuperacao', 'ct-35-email-meta.json', {
    id: latest.id,
    to: latest.to,
    subject: latest.subject,
    receivedDate: latest.receivedDate,
  });
  expect(latest.subject).toMatch(/senha|Redefin/i);
  const html = await smtpHtml(request, latest.id);
  const token = extractToken(html);
  evidencia(
    'u6-recuperacao',
    'ct-35-link.txt',
    'link do backoffice /admin/redefinir-senha presente; token guardado só em /tmp para CT-37',
  );
  await page.evaluate((t) => {
    (window as any).__CT35_TOKEN__ = t;
  }, token);
  process.env.QA_CT35_TOKEN = token;
  (global as any).__neutral35 = neutral;
});

test('CT-36 pedido com e-mail de aluno da a mesma resposta e nao envia e-mail', async ({
  page,
  request,
}) => {
  const before = await smtpLatest(request, STUDENT.email);
  const beforeIds = new Set(before.map((m: any) => m.id));

  await page.goto('/admin/recuperar-senha');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(STUDENT.email);
  await page.getByRole('button', { name: 'Enviar instruções' }).click();
  await page.waitForTimeout(2000);
  const neutral = await page.locator('main').innerText();
  evidencia('u6-recuperacao', 'ct-36-resposta-neutra.txt', neutral);
  expect(neutral).toBe((global as any).__neutral35);

  await page.waitForTimeout(4000);
  const after = await smtpLatest(request, STUDENT.email);
  const novas = after.filter((m: any) => !beforeIds.has(m.id));
  evidencia('u6-recuperacao', 'ct-36-sem-email.json', {
    antes: before.length,
    depois: after.length,
    novas,
  });
  expect(novas).toEqual([]);
});

test('CT-37 link valido redefine encerra sessoes e nao vale de novo', async ({ browser }) => {
  const token = process.env.QA_CT35_TOKEN ?? '';
  expect(token, 'token do CT-35').not.toBe('');

  const oldCtx = await browser.newContext();
  const old = await oldCtx.newPage();
  await loginStaff(old, STAFF.professor.email, STAFF.professor.password);
  await old.goto('/admin/');
  await expect(old.getByText('professor')).toBeVisible({ timeout: 10000 });

  const freshCtx = await browser.newContext();
  const fresh = await freshCtx.newPage();
  try {
    await fresh.goto(`/admin/redefinir-senha?token=${token}`);
    await fresh.waitForTimeout(2000);
    const formText = await fresh.locator('main').innerText();
    evidencia('u6-recuperacao', 'ct-37-formulario.txt', formText);
    const passboxes = fresh.getByRole('textbox', { name: /[Ss]enha/ });
    expect(await passboxes.count()).toBeGreaterThanOrEqual(1);
    await passboxes.first().fill('Prof@Qa2027');
    if ((await passboxes.count()) > 1) {
      await passboxes.nth(1).fill('Prof@Qa2027');
    }
    await fresh.screenshot({ path: '../u6-recuperacao/evidencia/ct-37-formulario.png' });
    const confirm = fresh.getByRole('button', {
      name: /Redefinir|Salvar|Confirmar|Enviar/i,
    });
    await confirm.first().click();
    await fresh.waitForTimeout(3000);
    const afterText = await fresh.locator('main').innerText();
    evidencia('u6-recuperacao', 'ct-37-apos-redefinir.txt', afterText);
    await fresh.screenshot({ path: '../u6-recuperacao/evidencia/ct-37-apos.png' });

    // Sessões anteriores encerradas: a sessão antiga não vale mais.
    const sess = await currentSession(old);
    expect(sess.status).toBe(401);
    await old.goto('/admin/');
    await old.waitForURL(/\/admin\/entrar/, { timeout: 15000 });

    // Nova senha funciona.
    const checkCtx = await browser.newContext();
    const check = await checkCtx.newPage();
    await loginStaff(check, STAFF.professor.email, 'Prof@Qa2027');
    await checkCtx.close();

    // Link não vale de novo.
    await fresh.goto(`/admin/redefinir-senha?token=${token}`);
    await fresh.waitForTimeout(2000);
    const reuse = await fresh.locator('main').innerText();
    evidencia('u6-recuperacao', 'ct-37-reuso-link.txt', reuse);
    expect(reuse).toMatch(/não vale|expir|inválido|novo/i);
  } finally {
    await oldCtx.close();
    await freshCtx.close();
  }
});
