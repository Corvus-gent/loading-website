import {defineConfig, devices} from '@playwright/test';

const baseURL = 'https://localhost:8451';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'cube.spec.mjs',
  outputDir: 'test-results/cube',
  workers: 3,
  use: {baseURL, ignoreHTTPSErrors: true, trace: 'retain-on-failure'},
  projects: [
    {name: 'Chromium desktop', use: {...devices['Desktop Chrome']}},
    {name: 'Firefox desktop', use: {...devices['Desktop Firefox']}},
    {name: 'WebKit desktop', use: {...devices['Desktop Safari']}},
    {name: 'Android phone', use: {...devices['Pixel 7']}},
    {name: 'iPhone', use: {...devices['iPhone 13']}},
  ],
  webServer: {
    command: 'node tools/site/mobile-entry-server.mjs',
    url: baseURL,
    ignoreHTTPSErrors: true,
    env: {E2E_PORT: '4191', E2E_TLS_PORT: '8451', THECUBE_ACCESS_CODE: 'cube-e2e-fixture'},
  },
});
