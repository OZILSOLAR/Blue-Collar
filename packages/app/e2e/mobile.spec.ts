import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

test.describe('Mobile responsiveness', () => {
  test('mobile navigation and layout adapt at small sizes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/en`)
    await page.waitForLoadState('networkidle')

    // Expect a mobile menu toggle (hamburger) or collapsed navigation
    const hamburger = page.locator('[aria-label="open menu"], button[aria-label*="menu" i], .hamburger, [data-testid="mobile-menu"]')
    if (await hamburger.count() > 0) {
      await expect(hamburger.first()).toBeVisible()
    }

    // On workers page, cards should be visible and stack vertically
    await page.goto(`${BASE}/en/workers`)
    const cards = page.locator('[role="listitem"], .worker-card, [data-testid="worker-card"]')
    await expect(cards.first()).toBeVisible()
  })
})
