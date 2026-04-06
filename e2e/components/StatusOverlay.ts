import { type Locator, type Page } from '@playwright/test'

export class StatusOverlay {
  readonly container: Locator
  readonly altitudeLabel: Locator
  readonly altitudeValue: Locator
  readonly distanceLabel: Locator
  readonly distanceValue: Locator

  constructor(page: Page) {
    this.container = page.locator('.status-overlay')
    this.altitudeLabel = this.container.locator('.status-label:has-text("Altitude:")')
    this.distanceLabel = this.container.locator('.status-label:has-text("Distance:")')
    this.altitudeValue = this.container.locator('.status-value').first()
    this.distanceValue = this.container.locator('.status-value').last()
  }

  async getAltitudeText(): Promise<string | null> {
    return this.altitudeValue.textContent()
  }

  async getDistanceText(): Promise<string | null> {
    return this.distanceValue.textContent()
  }
}
