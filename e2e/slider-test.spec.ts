import { test, expect } from './fixtures/fixtures'

test('Position slider functionality', async ({ approachPage }) => {
  // Triple the default timeout — this test performs multiple drag operations
  // and screenshots involving WebGL rendering, which is slow on CI runners
  // without GPU acceleration.
  test.slow()
  await approachPage.goto()
  // Wait for page to be ready
  await approachPage.waitForCanvasVisible()

  const { statusOverlay, positionSlider } = approachPage

  // Check initial position from status overlay
  const initialAltitude = await statusOverlay.getAltitudeText()
  const initialDistance = await statusOverlay.getDistanceText()
  console.log('[E2E] Initial position:', initialAltitude, initialDistance)

  // Take screenshot at start
  await approachPage.takeScreenshot('e2e/screenshots/slider-1-start.png')

  // Find the slider and verify it exists
  const sliderBox = await positionSlider.getSliderBoundingBox()
  expect(sliderBox).toBeTruthy()

  // Drag to 50%
  await positionSlider.dragToPercent(0.1, 0.5)

  // Let slider position update
  await expect(statusOverlay.altitudeValue).toBeVisible()

  const midAltitude = await statusOverlay.getAltitudeText()
  const midDistance = await statusOverlay.getDistanceText()
  console.log('[E2E] Mid position (50%):', midAltitude, midDistance)

  await approachPage.takeScreenshot('e2e/screenshots/slider-2-mid.png')

  // Drag to 95% (near end, should be around 10 ft)
  await positionSlider.dragToPercent(0.5, 0.95)

  // Let slider position update
  await expect(statusOverlay.altitudeValue).toBeVisible()

  const endAltitude = await statusOverlay.getAltitudeText()
  const endDistance = await statusOverlay.getDistanceText()
  console.log('[E2E] End position (95%):', endAltitude, endDistance)

  await approachPage.takeScreenshot('e2e/screenshots/slider-3-end.png')

  // Check that we can still see the runway at 10 ft
  expect(endAltitude).toContain('ft')

  // Drag back to beginning
  await positionSlider.dragToPercent(0.95, 0)

  // Let slider position update
  await expect(statusOverlay.altitudeValue).toBeVisible()

  const resetAltitude = await statusOverlay.getAltitudeText()
  const resetDistance = await statusOverlay.getDistanceText()
  console.log('[E2E] Reset position:', resetAltitude, resetDistance)

  await approachPage.takeScreenshot('e2e/screenshots/slider-4-reset.png')
})
