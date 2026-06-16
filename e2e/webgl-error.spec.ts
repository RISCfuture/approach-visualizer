import { test, expect } from './fixtures/fixtures'

test.describe('WebGL Error Handling', () => {
  test.describe('with WebGL disabled', () => {
    test.use({ webGLDisabled: true })

    test('displays error message when WebGL is disabled', async ({ webGLErrorPage }) => {
      await webGLErrorPage.goto()

      // Check if the WebGL error message is displayed
      await expect(webGLErrorPage.errorContainer).toBeVisible({ timeout: 10000 })

      // Verify the error message content
      await expect(webGLErrorPage.errorTitle).toHaveText('WebGL Not Supported')

      // Verify that helpful suggestions are shown
      await expect(webGLErrorPage.suggestions).toHaveCount(4)

      // Check specific suggestion text
      await expect(webGLErrorPage.getSuggestionAt(0)).toContainText('modern browser')
      await expect(webGLErrorPage.getSuggestionAt(1)).toContainText('hardware acceleration')
      await expect(webGLErrorPage.getSuggestionAt(2)).toContainText('graphics drivers')
      await expect(webGLErrorPage.getSuggestionAt(3)).toContainText('WebGL is blocked')

      // Verify that the status overlay is NOT displayed
      await expect(webGLErrorPage.statusOverlay).toBeHidden()

      // Verify that the canvas still exists (even though WebGL failed)
      await expect(webGLErrorPage.canvas).toBeVisible()
    })

    test.describe('on a mobile viewport', () => {
      test.use({ viewport: { width: 375, height: 667 } })

      test('error message is responsive on mobile', async ({ webGLErrorPage }) => {
        await webGLErrorPage.goto()

        // Check that error message is displayed and responsive
        await expect(webGLErrorPage.errorContainer).toBeVisible({ timeout: 10000 })

        // Verify responsive styling
        const boundingBox = await webGLErrorPage.getErrorContainerBoundingBox()
        expect(boundingBox).toBeTruthy()

        // On mobile, the error container should be 95% width
        const viewportWidth = 375
        const expectedMaxWidth = viewportWidth * 0.95
        expect(boundingBox!.width).toBeLessThanOrEqual(expectedMaxWidth)
      })
    })
  })

  test('renders 3D scene when WebGL is enabled', async ({ approachPage, webGLErrorPage }) => {
    await approachPage.goto()
    await approachPage.page.waitForLoadState('domcontentloaded')

    // Verify that the error message is NOT displayed
    await expect(webGLErrorPage.errorContainer).toBeHidden()

    // Verify that the status overlay IS displayed
    await expect(approachPage.statusOverlay.container).toBeVisible({ timeout: 10000 })

    // Verify that altitude and distance indicators are shown
    await expect(approachPage.statusOverlay.altitudeLabel).toBeVisible()
    await expect(approachPage.statusOverlay.distanceLabel).toBeVisible()

    // Verify canvas is present
    await expect(approachPage.canvas).toBeVisible()
  })
})
