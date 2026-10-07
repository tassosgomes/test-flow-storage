import { test } from '@playwright/test';
import { ADMIN, evidencia, loginStaff } from './helpers';

test('sonda lista membros', async ({ page }) => {
  await loginStaff(page, ADMIN.email, ADMIN.password);
  const dump = await page.evaluate(async () => {
    const r = await fetch('/api/v1/staff-members?page=1&size=100', {
      headers: { Accept: 'application/json' },
    });
    const t = await r.text();
    return { status: r.status, len: t.length, sample: t.slice(0, 800) };
  });
  evidencia('u4-papeis', 'sonda-lista.json', dump as any);
});
