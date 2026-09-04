import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://udify.app/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<main>江小满 Dify 测试替身</main>' })
  })
})

test('uses the approved two-column desktop layout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only assertion')
  await page.goto('/')
  const columns = await page.locator('.experience-card').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  )
  expect(columns.split(' ')).toHaveLength(2)
})
