import { test, expect } from './fixtures/fixtures'
import { LocaleSwitcher } from './components/LocaleSwitcher'

const approachMinimumLabel = (page: import('@playwright/test').Page) =>
  page.locator('label[for="approach-minimum"]')

test.describe('Localization', () => {
  test.describe('German on a mobile viewport', () => {
    test.use({ locale: 'de-DE', viewport: { width: 360, height: 780 } })

    test('defaults to the browser locale and fits without horizontal overflow', async ({
      approachPage,
    }) => {
      await approachPage.goto()
      await expect(approachPage.header).toBeVisible({ timeout: 10000 })

      // Browser preference (de-DE) is detected and reflected on <html lang>.
      await expect(approachMinimumLabel(approachPage.page)).toHaveText('Anflugminimum')
      await expect(approachPage.page.locator('html')).toHaveAttribute('lang', 'de-DE')

      // German is verbose: the layout must not overflow the narrow viewport.
      const overflow = await approachPage.page.evaluate(() => {
        const el = document.documentElement
        return el.scrollWidth - el.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })

  test.describe('switching language', () => {
    test.use({ locale: 'en-US' })

    test('changes the UI language from the globe menu and persists it', async ({
      approachPage,
    }) => {
      await approachPage.goto()
      await expect(approachPage.header).toBeVisible({ timeout: 10000 })
      await expect(approachMinimumLabel(approachPage.page)).toHaveText('Approach Minimum')

      const switcher = new LocaleSwitcher(approachPage.page)
      await switcher.choose('Deutsch (Deutschland)')

      await expect(approachMinimumLabel(approachPage.page)).toHaveText('Anflugminimum')
      await expect(approachPage.page.locator('html')).toHaveAttribute('lang', 'de-DE')

      const stored = await approachPage.page.evaluate(() =>
        localStorage.getItem('approach-visualizer.locale'),
      )
      expect(stored).toBe('de-DE')
    })
  })
})
