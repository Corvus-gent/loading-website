import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:2,timeout:45000,use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4176',trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list']],outputDir:'test-results/phone',projects:[
 {name:'android',testMatch:['personas.spec.mjs','persona-hubs.spec.mjs','mobile-audit.spec.mjs'],use:{...devices['Pixel 5']}},
 {name:'iphone',testMatch:['mobile-audit.spec.mjs'],use:{...devices['iPhone 13']}},
]});
