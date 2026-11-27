import {defineConfig, devices} from '@playwright/test';
const local = 'http://127.0.0.1:4176';
export default defineConfig({
  testDir: '.', testMatch: 'flows.spec.js', timeout: 60_000,
  outputDir: '../../test-results/cube-flows', workers: 1,
  reporter: [['list'], ['html', {open:'never', outputFolder:'../../playwright-report/cube-flows'}]],
  use: {storageState:process.env.CUBE_PREVIEW_STATE, baseURL:process.env.BASE || local, serviceWorkers:'block', locale:'en-US'},
  webServer: process.env.BASE ? undefined : {command:'node ../../tools/cube/serve.mjs', port:4176, reuseExistingServer:!process.env.CI},
  projects: Object.entries({'desktop-chrome':'Desktop Chrome','desktop-safari':'Desktop Safari','desktop-firefox':'Desktop Firefox','iphone':'iPhone 14','android':'Pixel 7'}).map(([name, device]) => ({name, use:devices[device]})),
});
