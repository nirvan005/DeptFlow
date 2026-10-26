import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  workers:1,
  timeout:30000,
  reporter:'list',
  use:{baseURL:'http://127.0.0.1:3107',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'edge',use:{...devices['Desktop Edge'],channel:'msedge'}}],
  webServer:{command:'node tests/e2e/server.js',url:'http://127.0.0.1:3107/api/health',reuseExistingServer:false,timeout:30000}
});
