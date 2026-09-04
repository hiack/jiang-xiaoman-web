import { expect, test } from '@playwright/test'

const sseStream =
  'data: {"event":"message","answer":"我在呢。"}\n\n' +
  'data: {"event":"message_end","conversation_id":"conv-e2e"}\n\n'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'cache-control': 'no-store' },
      body: sseStream,
    }),
  )
})

test('shows the branded chat window instead of the Dify iframe', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '“……你来了呀。”' })).toBeVisible()
  await expect(page.getByRole('region', { name: '江小满聊天区' })).toBeVisible()
  await expect(page.getByLabel('和江小满聊天')).toBeVisible()
  await expect(page.getByRole('link', { name: '直接打开原对话' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText(/Token|耗时|点赞|测试替身/)).toHaveCount(0)
})

test('never overflows horizontally on any viewport', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('keeps the approved two-column desktop layout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only assertion')
  await page.goto('/')
  const columns = await page
    .locator('.experience-card')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columns.trim().split(/\s+/)).toHaveLength(2)
})

test('stacks the layout on mobile and keeps the composer reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion')
  await page.goto('/')
  const columns = await page
    .locator('.experience-card')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columns.trim().split(/\s+/)).toHaveLength(1)

  const composer = page.getByLabel('和江小满聊天')
  await composer.scrollIntoViewIfNeeded()
  await expect(composer).toBeVisible()
})

test('sends a message, streams the reply and resets the local chat', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'send flow on desktop')
  await page.goto('/')

  const input = page.getByLabel('和江小满聊天')
  await input.fill('你好呀')
  await input.press('Enter')

  await expect(page.getByText('你好呀', { exact: true })).toBeVisible()
  await expect(page.getByText('我在呢。', { exact: true })).toBeVisible()

  await expect(page.getByRole('img', { name: '江小满', exact: true })).toHaveAttribute(
    'src',
    /jiang-xiaoman-original\.png/,
  )
  await expect(page.getByRole('img', { name: '你', exact: true })).toHaveAttribute(
    'src',
    /user-avatar-anonymous-short-hair\.png/,
  )

  await page.getByRole('button', { name: '重新开始' }).click()
  await expect(page.getByText(/确定要重新开始吗/)).toBeVisible()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(page.getByText('你好呀', { exact: true })).toHaveCount(0)
})
