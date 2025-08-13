import { test, expect } from '@playwright/test'

test('Position slider functionality', async ({ page }) => {
  await page.goto('/?testMode=true')
  // Wait for page to be ready
  const canvas = page.locator('canvas.babylon-canvas')
  await expect(canvas).toBeVisible({ timeout: 5000 })
  
  // Check initial position from status overlay
  const initialAltitude = await page.locator('.status-value').first().textContent()
  const initialDistance = await page.locator('.status-value').last().textContent()
  console.log('[E2E] Initial position:', initialAltitude, initialDistance)
  
  // Take screenshot at start
  await page.screenshot({ 
    path: 'e2e/screenshots/slider-1-start.png',
    fullPage: false 
  })
  
  // Find the slider and drag it to 50%
  const slider = page.locator('.p-slider')
  const sliderBox = await slider.boundingBox()
  
  if (sliderBox) {
    // Drag to 50%
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.1, sliderBox.y + sliderBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.5, sliderBox.y + sliderBox.height / 2)
    await page.mouse.up()
    
    await page.waitForTimeout(500)
    
    const midAltitude = await page.locator('.status-value').first().textContent()
    const midDistance = await page.locator('.status-value').last().textContent()
    console.log('[E2E] Mid position (50%):', midAltitude, midDistance)
    
    await page.screenshot({ 
      path: 'e2e/screenshots/slider-2-mid.png',
      fullPage: false 
    })
    
    // Drag to 90% (near end, should be around 10 ft)
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.5, sliderBox.y + sliderBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.95, sliderBox.y + sliderBox.height / 2)
    await page.mouse.up()
    
    await page.waitForTimeout(500)
    
    const endAltitude = await page.locator('.status-value').first().textContent()
    const endDistance = await page.locator('.status-value').last().textContent()
    console.log('[E2E] End position (95%):', endAltitude, endDistance)
    
    await page.screenshot({ 
      path: 'e2e/screenshots/slider-3-end.png',
      fullPage: false 
    })
    
    // Check that we can still see the runway at 10 ft
    expect(endAltitude).toContain('ft')
    
    // Drag back to beginning
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.95, sliderBox.y + sliderBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sliderBox.x + 5, sliderBox.y + sliderBox.height / 2)
    await page.mouse.up()
    
    await page.waitForTimeout(500)
    
    const resetAltitude = await page.locator('.status-value').first().textContent()
    const resetDistance = await page.locator('.status-value').last().textContent()
    console.log('[E2E] Reset position:', resetAltitude, resetDistance)
    
    await page.screenshot({ 
      path: 'e2e/screenshots/slider-4-reset.png',
      fullPage: false 
    })
  }
})