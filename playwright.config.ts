import { defineConfig, devices } from '@playwright/test'

// E2E exercises the real client against a mocked /api/chat proxy, so the app
// must boot in the "configured" state. This is a local-only, non-secret value.
if (!process.env.VITE_CHAT_API_URL) {
  process.env.VITE_CHAT_API_URL = 'http://127.0.0.1:4173'
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
})
