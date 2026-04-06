import { type Locator, type Page } from '@playwright/test'

export class WebGLErrorPage {
  readonly page: Page
  readonly errorContainer: Locator
  readonly errorTitle: Locator
  readonly suggestions: Locator
  readonly statusOverlay: Locator
  readonly canvas: Locator

  constructor(page: Page) {
    this.page = page
    this.errorContainer = page.locator('.webgl-error')
    this.errorTitle = this.errorContainer.getByRole('heading', { name: 'WebGL Not Supported' })
    this.suggestions = this.errorContainer.locator('.suggestions li')
    this.statusOverlay = page.locator('.status-overlay')
    this.canvas = page.locator('canvas.babylon-canvas')
  }

  async goto() {
    await this.page.goto('/?testMode=true')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async getErrorContainerBoundingBox() {
    return this.errorContainer.boundingBox()
  }

  getSuggestionAt(index: number): Locator {
    return this.suggestions.nth(index)
  }
}
