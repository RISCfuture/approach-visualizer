import { test, expect } from '@playwright/test'

test.describe('WebGL Error Handling', () => {
  test('displays error message when WebGL is disabled', async ({ browser }) => {
    // Create a new context with WebGL disabled
    const context = await browser.newContext({
      // Disable WebGL by using Chrome/Chromium flags
      // Note: This only works reliably in Chromium-based browsers
      ...(browser.browserType().name() === 'chromium' && {
        args: ['--disable-webgl', '--disable-webgl2']
      })
    })
    
    const page = await context.newPage()
    
    // Add a script to override WebGL detection
    await page.addInitScript(() => {
      // Override the WebGL context creation to always fail
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(
        this: HTMLCanvasElement,
        contextType: string,
        ...args: unknown[]
      ): RenderingContext | null {
        if (contextType === 'webgl' || contextType === 'webgl2' || 
            contextType === 'experimental-webgl' || contextType === 'experimental-webgl2') {
          return null
        }
        return originalGetContext.apply(this, [contextType, ...args] as Parameters<typeof originalGetContext>) as RenderingContext | null
      }
      
      // Also override WebGLRenderingContext if it exists
      if (typeof WebGLRenderingContext !== 'undefined') {
        (window as Window & { WebGLRenderingContext?: undefined }).WebGLRenderingContext = undefined
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        (window as Window & { WebGL2RenderingContext?: undefined }).WebGL2RenderingContext = undefined
      }
    })
    
    // Navigate to the page
    await page.goto('/?testMode=true')
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded')
    
    // Check if the WebGL error message is displayed
    const errorContainer = page.locator('.webgl-error')
    await expect(errorContainer).toBeVisible({ timeout: 10000 })
    
    // Verify the error message content
    const errorTitle = errorContainer.locator('h3')
    await expect(errorTitle).toHaveText('WebGL Not Supported')
    
    // Verify that helpful suggestions are shown
    const suggestions = errorContainer.locator('.suggestions li')
    await expect(suggestions).toHaveCount(4)
    
    // Check specific suggestion text
    await expect(suggestions.nth(0)).toContainText('modern browser')
    await expect(suggestions.nth(1)).toContainText('hardware acceleration')
    await expect(suggestions.nth(2)).toContainText('graphics drivers')
    await expect(suggestions.nth(3)).toContainText('WebGL is blocked')
    
    // Verify that the status overlay is NOT displayed
    const statusOverlay = page.locator('.status-overlay')
    await expect(statusOverlay).toBeHidden()
    
    // Verify that the canvas still exists (even though WebGL failed)
    const canvas = page.locator('canvas.babylon-canvas')
    await expect(canvas).toBeVisible()
    
    await context.close()
  })
  
  test('renders 3D scene when WebGL is enabled', async ({ page }) => {
    // Normal navigation without WebGL disabled
    await page.goto('/?testMode=true')
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded')
    
    // Verify that the error message is NOT displayed
    const errorContainer = page.locator('.webgl-error')
    await expect(errorContainer).toBeHidden()
    
    // Verify that the status overlay IS displayed
    const statusOverlay = page.locator('.status-overlay')
    await expect(statusOverlay).toBeVisible({ timeout: 10000 })
    
    // Verify that altitude and distance indicators are shown
    const altitudeLabel = statusOverlay.locator('.status-label:has-text("Altitude:")')
    const distanceLabel = statusOverlay.locator('.status-label:has-text("Distance:")')
    await expect(altitudeLabel).toBeVisible()
    await expect(distanceLabel).toBeVisible()
    
    // Verify canvas is present
    const canvas = page.locator('canvas.babylon-canvas')
    await expect(canvas).toBeVisible()
  })
  
  test('error message is responsive on mobile', async ({ browser }) => {
    // Create a mobile viewport context with WebGL disabled
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      ...(browser.browserType().name() === 'chromium' && {
        args: ['--disable-webgl', '--disable-webgl2']
      })
    })
    
    const page = await context.newPage()
    
    // Add script to disable WebGL
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(
        this: HTMLCanvasElement,
        contextType: string,
        ...args: unknown[]
      ): RenderingContext | null {
        if (contextType === 'webgl' || contextType === 'webgl2' || 
            contextType === 'experimental-webgl' || contextType === 'experimental-webgl2') {
          return null
        }
        return originalGetContext.apply(this, [contextType, ...args] as Parameters<typeof originalGetContext>) as RenderingContext | null
      }
    })
    
    await page.goto('/?testMode=true')
    await page.waitForLoadState('domcontentloaded')
    
    // Check that error message is displayed and responsive
    const errorContainer = page.locator('.webgl-error')
    await expect(errorContainer).toBeVisible({ timeout: 10000 })
    
    // Verify responsive styling
    const boundingBox = await errorContainer.boundingBox()
    expect(boundingBox).toBeTruthy()
    
    // On mobile, the error container should be 95% width
    const viewportWidth = 375
    const expectedMaxWidth = viewportWidth * 0.95
    expect(boundingBox!.width).toBeLessThanOrEqual(expectedMaxWidth)
    
    await context.close()
  })
})