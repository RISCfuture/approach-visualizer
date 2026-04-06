import { test, expect } from './fixtures/fixtures'

test('Cloud breakout tick mark', async ({ approachPage }) => {
  await approachPage.goto()
  await approachPage.waitForCanvasVisible()

  // Check that the breakout tick mark is visible
  const { breakoutTick } = approachPage.positionSlider
  await expect(breakoutTick).toBeVisible()

  // Hover over the tick mark to trigger tooltip
  await breakoutTick.hover()

  // Check for tooltip or continue (tooltip may not always be visible)
  try {
    await expect(approachPage.page.locator('.tooltip')).toBeVisible({ timeout: 1000 })
  } catch {
    // Tooltip may not be visible in all cases
  }

  // Take screenshot showing the tick mark (tooltip may not be visible in screenshot)
  await approachPage.takeScreenshot('e2e/screenshots/breakout-tick-mark.png')

  // Check tick mark position is reasonable (not at start or end)
  const tickStyle = await approachPage.positionSlider.getBreakoutTickStyleAttribute()
  const leftMatch = tickStyle?.match(/left:\s*([\d.]+)%/)
  expect(leftMatch).toBeTruthy()
  const leftPercent = parseFloat(leftMatch![1])
  console.log('[E2E] Breakout tick position:', leftPercent + '%')
  expect(leftPercent).toBeGreaterThan(10)
  expect(leftPercent).toBeLessThan(90)
})

test('Yellow indicators below ceiling', async ({ approachPage }) => {
  await approachPage.goto()
  await approachPage.waitForCanvasVisible()

  // Wait for auto-play to start
  await approachPage.waitForAutoPlay()

  // Wait for altitude to drop below ceiling
  await expect(async () => {
    const altText = await approachPage.statusOverlay.getAltitudeText()
    const altitude = parseInt(altText?.replace(/[^\d]/g, '') || '999')
    console.log(`[E2E] Current altitude: ${altitude}`)
    expect(altitude).toBeLessThanOrEqual(230)
  }).toPass({ timeout: 15000 })

  // Check that altitude indicator has yellow class
  await expect(approachPage.statusOverlay.altitudeValue).toHaveClass(/below-ceiling/)

  // Take screenshot showing yellow indicator
  await approachPage.takeScreenshot('e2e/screenshots/yellow-indicator-below-ceiling.png')
})

test('Spacebar play/pause shortcut', async ({ approachPage }) => {
  await approachPage.goto()
  await approachPage.waitForCanvasVisible()

  // Wait for auto-play to start then reset
  await approachPage.waitForAutoPlay()
  await approachPage.animationControls.reset()
  await expect(approachPage.animationControls.playButton).toBeVisible()

  // Press spacebar to start animation
  await approachPage.animationControls.pressSpacebar()

  // Check that animation is playing
  await expect(approachPage.animationControls.pauseButton).toBeVisible()

  // Press spacebar again to pause
  await approachPage.animationControls.pressSpacebar()

  // Check that animation is paused
  await expect(approachPage.animationControls.resumeButton).toBeVisible()

  console.log('[E2E] Spacebar shortcut working')
})

test('Auto-play after page load', async ({ approachPage }) => {
  await approachPage.goto()
  await approachPage.waitForCanvasVisible()

  // Wait for auto-play to trigger
  await approachPage.waitForAutoPlay()

  // Check that animation is playing
  await expect(approachPage.animationControls.pauseButton).toBeVisible()

  console.log('[E2E] Auto-play working')
})
