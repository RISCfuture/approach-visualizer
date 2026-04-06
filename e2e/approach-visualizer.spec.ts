import { test, expect } from './fixtures/fixtures'

test.describe('Approach Visualizer', () => {
  test('checks form layout issues', async ({ approachPage }) => {
    await approachPage.goto()
    await expect(approachPage.header).toBeVisible({ timeout: 10000 })

    // Check that basic form elements are visible and positioned correctly
    const count = await approachPage.getFormFieldCount()

    // Verify we have form fields
    expect(count).toBeGreaterThan(0)

    // Check that each form field is visible and has reasonable dimensions
    for (let i = 0; i < count; i++) {
      const field = approachPage.getFormFieldAt(i)
      await expect(field).toBeVisible()

      const box = await approachPage.getFormFieldBoundingBox(i)
      expect(box).toBeTruthy()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.height).toBeGreaterThan(0)
    }

    // Verify controls are accessible and not completely hidden
    const controlCount = await approachPage.getControlCount()
    expect(controlCount).toBeGreaterThan(0)
  })
})
