import {defineConfig} from '@playwright/test';

if (!process.env.BASE_URL) throw new Error('Set BASE_URL to the Cube deployment to test.');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'the6cube.spec.js',
  outputDir: 'test-results/cube',
  reporter: 'list',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: new URL(process.env.BASE_URL).origin,
    browserName: 'chromium',
    locale: 'en-US',
    serviceWorkers: 'block',
  },
});
