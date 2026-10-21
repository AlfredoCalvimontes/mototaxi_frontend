import { defineConfig } from '@playwright/test';

// Own port: 5173 is shared with taxi_management_front in ~/.dev-ports.yaml.
const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
});
