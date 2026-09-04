import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://udify.app/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<main>江小满 Dify 测试替身</main>' })
  })
})

test('shows the approved hero and embedded chat without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '“……你来了呀。”' })).toBeVisible()
  await expect(page.getByTitle('与江小满对话')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('uses the approved two-column desktop layout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only assertion')
  await page.goto('/')
  const columns = await page.locator('.experience-card').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  )
  expect(columns.split(' ')).toHaveLength(2)
})

test('keeps chat visible in a mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion')
  await page.goto('/')
  const frame = page.getByTitle('与江小满对话')
  await expect(frame).toBeVisible()
  const box = await frame.boundingBox()
  expect(box?.y).toBeLessThan(360)
})
