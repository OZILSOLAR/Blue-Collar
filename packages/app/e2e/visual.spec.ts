import { test, expect } from '@playwright/test'
import percySnapshot from '@percy/playwright'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

/**
 * Visual regression tests using Playwright's built-in screenshot comparison
 * plus optional Percy uploads when `PERCY_TOKEN` is available.
 *
 * Local: Run `pnpm test:e2e --update-snapshots` to update baseline screenshots.
 */
test.describe('Visual regression', () => {
  test('home page matches snapshot (desktop)', async ({ page }) => {
    await page.goto(`${BASE}/en`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('home.desktop.png')

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Home Page - Desktop')
    }
  })

  test('home page matches snapshot (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/en`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('home.mobile.png')

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Home Page - Mobile')
    }
  })

  test('workers listing page matches snapshot', async ({ page }) => {
    await page.goto(`${BASE}/en/workers`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('workers-list.png')

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Workers Listing')
    }
  })

  test('worker profile page matches snapshot', async ({ page }) => {
    await page.goto(`${BASE}/en/workers/test-worker-1`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('worker-profile.png')

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Worker Profile')
    }
  })

  test('auth pages match snapshots', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('login.png')

    await page.goto(`${BASE}/en/auth/register`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('register.png')
  })
})
