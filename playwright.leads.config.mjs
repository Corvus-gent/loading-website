import {defineConfig,devices} from '@playwright/test';
const baseURL='https://localhost:8453';
// Serial: the outage test stops the shared Redis.
export default defineConfig({testDir:'./tests/e2e',outputDir:'test-results/leadhunter',testMatch:'leadhunter-flows.spec.js',timeout:30000,workers:1,use:{baseURL,ignoreHTTPSErrors:true,trace:'retain-on-failure'},projects:[{name:'Chromium desktop',use:{browserName:'chromium',viewport:{width:1365,height:900}}},{name:'WebKit desktop (Safari, DuckDuckGo)',use:{browserName:'webkit',viewport:{width:1365,height:900}}},{name:'iPhone (WebKit)',use:{...devices['iPhone 13']}}],webServer:{command:'node tools/site/leads-e2e-server.mjs',url:baseURL+'/__fixture/ok',ignoreHTTPSErrors:true,reuseExistingServer:false}});
