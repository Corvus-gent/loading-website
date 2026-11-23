import {defineConfig} from '@playwright/test';

const baseURL = `http://127.0.0.1:${process.env.E2E_PORT || 4184}`;
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/launch-e2e',
  testMatch: '*.spec.js',
  fullyParallel: true,
  workers: 3,
  timeout: 25_000,
  reporter: 'list',
  use: {baseURL, browserName: 'chromium', timezoneId: 'Europe/Brussels', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 900}}},
    {name: 'mobile', use: {viewport: {width: 375, height: 812}, isMobile: true, hasTouch: true}},
    {name: 'reduced motion', use: {viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'}},
  ],
  webServer: {command: 'node tools/site/e2e-server.mjs', url: baseURL, timeout: 10_000},
});
