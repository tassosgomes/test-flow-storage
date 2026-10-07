import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['*.spec.ts'],
  workers: 1,
  timeout: 90000,
  retries: 0,
  reporter: [['line'], ['json', { outputFile: './test-output/resultados.json' }]],
  use: {
    baseURL: 'https://c4c-admin.lab.tasso.dev.br',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath:
            '/home/tsgomes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
          args: ['--no-sandbox'],
        },
      },
    },
  ],
  outputDir: './test-output',
});
