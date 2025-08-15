import { test, expect } from '@playwright/test'

test.describe('Approach Visualizer', () => {
  test('checks form layout issues', async ({ page }) => {
    await page.goto('/?testMode=true')
    const header = page.locator('.app-header')
    await expect(header).toBeVisible({ timeout: 10000 })
    
    // Check that basic form elements are visible and positioned correctly
    const formFields = page.locator('.form-field')
    const count = await formFields.count()
    
    // Verify we have form fields
    expect(count).toBeGreaterThan(0)
    
    // Check that each form field is visible and has reasonable dimensions
    for (let i = 0; i < count; i++) {
      const field = formFields.nth(i)
      await expect(field).toBeVisible()
      
      const box = await field.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.height).toBeGreaterThan(0)
    }
    
    // Verify controls are accessible and not completely hidden
    const controls = page.locator('button, input, select')
    const controlCount = await controls.count()
    expect(controlCount).toBeGreaterThan(0)
  })
})