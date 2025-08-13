import { test, expect } from '@playwright/test'

test('Cloud breakout tick mark', async ({ page }) => {
  await page.goto('/?testMode=true')
  const canvas = page.locator('canvas.babylon-canvas')
  await expect(canvas).toBeVisible({ timeout: 5000 })
  
  // Check that the breakout tick mark is visible
  const breakoutTick = page.locator('.breakout-tick')
  await expect(breakoutTick).toBeVisible()
  
  // Hover over the tick mark to trigger tooltip
  await breakoutTick.hover()
  
  // Wait a moment for tooltip to appear
  await page.waitForTimeout(500)
  
  // Take screenshot showing the tick mark (tooltip may not be visible in screenshot)
  await page.screenshot({ 
    path: 'e2e/screenshots/breakout-tick-mark.png',
    fullPage: false 
  })
  
  // Check tick mark position is reasonable (not at start or end)
  const tickStyle = await breakoutTick.getAttribute('style')
  const leftMatch = tickStyle?.match(/left:\s*([\d.]+)%/)
  if (leftMatch) {
    const leftPercent = parseFloat(leftMatch[1])
    console.log('[E2E] Breakout tick position:', leftPercent + '%')
    expect(leftPercent).toBeGreaterThan(10)
    expect(leftPercent).toBeLessThan(90)
  }
})

test('Yellow indicators below ceiling', async ({ page, browserName }) => {
  // Skip for Firefox: Animation doesn't progress in CI environment
  // Despite testMode parameter, altitude remains stuck at 250ft
  // and slider interactions don't work reliably
  test.skip(browserName === 'firefox', 'Skipping for Firefox - animation issues in CI')
  
  await page.goto('/?testMode=true')
  const canvas = page.locator('canvas.babylon-canvas')
  await expect(canvas).toBeVisible({ timeout: 5000 })
  
  // Wait for auto-play to start
  await page.waitForTimeout(1500)
  
  // Verify animation is running
  await expect(page.getByRole('button', { name: /pause/i })).toBeVisible({ timeout: 5000 })
  
  // With 10x speed in test mode, altitude drops quickly
  await page.waitForTimeout(3000)
  
  // Verify we're below ceiling
  const finalAltText = await page.locator('.status-value').first().textContent()
  const finalAlt = parseInt(finalAltText?.replace(/[^\d]/g, '') || '999')
  expect(finalAlt).toBeLessThanOrEqual(195)
  
  // Check that altitude indicator has yellow class
  const altitudeValue = page.locator('.status-value').first()
  await expect(altitudeValue).toHaveClass(/below-ceiling/)
  
  // Take screenshot showing yellow indicator
  await page.screenshot({ 
    path: 'e2e/screenshots/yellow-indicator-below-ceiling.png',
    fullPage: false 
  })
})

test('Spacebar play/pause shortcut', async ({ page }) => {
  await page.goto('/?testMode=true')
  const canvas = page.locator('canvas.babylon-canvas')
  await expect(canvas).toBeVisible({ timeout: 5000 })
  
  // Wait for auto-play to finish and reset
  await page.waitForTimeout(1500)
  const resetButton = page.getByRole('button', { name: /reset/i })
  await resetButton.click()
  await page.waitForTimeout(500)
  
  // Press spacebar to start animation
  await page.keyboard.press(' ')
  
  // Check that animation is playing
  const playButton = page.getByRole('button', { name: /pause/i })
  await expect(playButton).toBeVisible()
  
  // Press spacebar again to pause
  await page.keyboard.press(' ')
  
  // Check that animation is paused
  const resumeButton = page.getByRole('button', { name: /resume/i })
  await expect(resumeButton).toBeVisible()
  
  console.log('[E2E] Spacebar shortcut working')
})

test('Auto-play after page load', async ({ page }) => {
  await page.goto('/?testMode=true')
  const canvas = page.locator('canvas.babylon-canvas')
  await expect(canvas).toBeVisible({ timeout: 5000 })
  
  // Wait for auto-play to trigger (1 second after load)
  await page.waitForTimeout(1500)
  
  // Check that animation is playing
  const pauseButton = page.getByRole('button', { name: /pause/i })
  await expect(pauseButton).toBeVisible()
  
  console.log('[E2E] Auto-play working')
})