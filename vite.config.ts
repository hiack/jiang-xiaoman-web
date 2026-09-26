import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Resolves the Vite `base` for this site.
 *
 * GitHub Pages serves a project site under `/<repo>/`, but the repository now
 * also answers on the custom apex domain tangzhaochu.com, which is served from
 * the site root. A root-served site must load `/assets/...`, not
 * `/jiang-xiaoman-web/assets/...`. `actions/configure-pages` reports the
 * difference in its `base_path` output (`"/jiang-xiaoman-web"` for the
 * github.io project URL, `""` for the custom domain), and the deploy workflow
 * passes it through as PAGES_BASE_PATH. The repository-path fallback keeps the
 * original github.io URL working when the variable is absent, and local dev /
 * preview always stay at `/`.
 */
export function resolvePagesBase(
  env: { GITHUB_ACTIONS?: string; PAGES_BASE_PATH?: string } = process.env,
): string {
  if (!env.GITHUB_ACTIONS) return '/'
  const path = (env.PAGES_BASE_PATH ?? '/jiang-xiaoman-web').replace(/^\/+|\/+$/g, '')
  return path === '' ? '/' : `/${path}/`
}

export default defineConfig({
  plugins: [react()],
  base: resolvePagesBase(),
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // `.worktrees/` is gitignored local tooling state; without this exclusion
    // `npm test` also collects a stale copy of the suite from the worktree.
    exclude: [...configDefaults.exclude, '.worktrees/**', 'e2e/**'],
  },
})
