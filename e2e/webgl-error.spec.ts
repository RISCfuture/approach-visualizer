import { test, expect } from './fixtures/fixtures'
import { WebGLErrorPage } from './pages/WebGLErrorPage'
import { ApproachVisualizerPage } from './pages/ApproachVisualizerPage'

const webGLDisableScript = () => {
  // Override the WebGL context creation to always fail
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextType: string,
    ...args: unknown[]
  ): RenderingContext | null {
    if (
      contextType === 'webgl' ||
      contextType === 'webgl2' ||
      contextType === 'experimental-webgl' ||
      contextType === 'experimental-webgl2'
    ) {
      return null
    }
    return originalGetContext.apply(this, [contextType, ...args] as Parameters<
      typeof originalGetContext
    >) as RenderingContext | null
  }

  // Also override WebGLRenderingContext if it exists
  if (typeof WebGLRenderingContext !== 'undefined') {
    ;(window as Window & { WebGLRenderingContext?: undefined }).WebGLRenderingContext = undefined
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    ;(window as Window & { WebGL2RenderingContext?: undefined }).WebGL2RenderingContext = undefined
  }
}

test.describe('WebGL Error Handling', () => {
  test('displays error message when WebGL is disabled', async ({ browser }) => {
    // Create a new context with WebGL disabled
    const context = await browser.newContext({
      ...(browser.browserType().name() === 'chromium' && {
        args: ['--disable-webgl', '--disable-webgl2'],
      }),
    })

    const page = await context.newPage()
    await page.addInitScript(webGLDisableScript)

    const errorPage = new WebGLErrorPage(page)
    await errorPage.goto()

    // Check if the WebGL error message is displayed
    await expect(errorPage.errorContainer).toBeVisible({ timeout: 10000 })

    // Verify the error message content
    await expect(errorPage.errorTitle).toHaveText('WebGL Not Supported')

    // Verify that helpful suggestions are shown
    await expect(errorPage.suggestions).toHaveCount(4)

    // Check specific suggestion text
    await expect(errorPage.getSuggestionAt(0)).toContainText('modern browser')
    await expect(errorPage.getSuggestionAt(1)).toContainText('hardware acceleration')
    await expect(errorPage.getSuggestionAt(2)).toContainText('graphics drivers')
    await expect(errorPage.getSuggestionAt(3)).toContainText('WebGL is blocked')

    // Verify that the status overlay is NOT displayed
    await expect(errorPage.statusOverlay).toBeHidden()

    // Verify that the canvas still exists (even though WebGL failed)
    await expect(errorPage.canvas).toBeVisible()

    await context.close()
  })

  test('renders 3D scene when WebGL is enabled', async ({ page }) => {
    const approachPage = new ApproachVisualizerPage(page)
    await approachPage.goto()
    await page.waitForLoadState('domcontentloaded')

    // Verify that the error message is NOT displayed
    const errorPage = new WebGLErrorPage(page)
    await expect(errorPage.errorContainer).toBeHidden()

    // Verify that the status overlay IS displayed
    await expect(approachPage.statusOverlay.container).toBeVisible({ timeout: 10000 })

    // Verify that altitude and distance indicators are shown
    await expect(approachPage.statusOverlay.altitudeLabel).toBeVisible()
    await expect(approachPage.statusOverlay.distanceLabel).toBeVisible()

    // Verify canvas is present
    await expect(approachPage.canvas).toBeVisible()
  })

  test('error message is responsive on mobile', async ({ browser }) => {
    // Create a mobile viewport context with WebGL disabled
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      ...(browser.browserType().name() === 'chromium' && {
        args: ['--disable-webgl', '--disable-webgl2'],
      }),
    })

    const page = await context.newPage()
    await page.addInitScript(webGLDisableScript)

    const errorPage = new WebGLErrorPage(page)
    await errorPage.goto()

    // Check that error message is displayed and responsive
    await expect(errorPage.errorContainer).toBeVisible({ timeout: 10000 })

    // Verify responsive styling
    const boundingBox = await errorPage.getErrorContainerBoundingBox()
    expect(boundingBox).toBeTruthy()

    // On mobile, the error container should be 95% width
    const viewportWidth = 375
    const expectedMaxWidth = viewportWidth * 0.95
    expect(boundingBox!.width).toBeLessThanOrEqual(expectedMaxWidth)

    await context.close()
  })
})
