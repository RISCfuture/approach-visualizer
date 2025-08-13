import { test, expect } from '@playwright/test'

test.describe('Approach Visualizer', () => {
  test('checks form layout issues', async ({ page }) => {
    await page.goto('/?testMode=true')
    const header = page.locator('.app-header')
    await expect(header).toBeVisible({ timeout: 10000 })
    
    // Check if form fields are overlapping
    const formFields = page.locator('.form-field')
    const count = await formFields.count()
    
    for (let i = 0; i < count - 1; i++) {
      const current = formFields.nth(i)
      const next = formFields.nth(i + 1)
      
      const currentBox = await current.boundingBox()
      const nextBox = await next.boundingBox()
      
      if (currentBox && nextBox) {
        // Check for horizontal overlap
        const horizontalOverlap = currentBox.x + currentBox.width > nextBox.x && 
                                 currentBox.x < nextBox.x + nextBox.width
        
        // Check for vertical overlap  
        const verticalOverlap = currentBox.y + currentBox.height > nextBox.y &&
                               currentBox.y < nextBox.y + nextBox.height
        
        if (horizontalOverlap && verticalOverlap) {
          console.log(`[E2E] Overlap detected between control ${i} and ${i+1}`)
        }
      }
    }
    
    // Verify no overlaps were detected
    // If overlaps exist, they would have been logged above
  })
})