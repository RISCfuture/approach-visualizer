import { type Locator, type Page } from '@playwright/test'

export class StatusOverlay {
  readonly container: Locator
  readonly altitudeLabel: Locator
  readonly altitudeValue: Locator
  readonly distanceLabel: Locator
  readonly distanceValue: Locator

  constructor(page: Page) {
    this.container = page.getByTestId('status-overlay')
    this.altitudeLabel = this.container.getByTestId('altitude-label')
    this.distanceLabel = this.container.getByTestId('distance-label')
    this.altitudeValue = this.container.getByTestId('altitude-value')
    this.distanceValue = this.container.getByTestId('distance-value')
  }

  async getAltitudeText(): Promise<string | null> {
    return this.altitudeValue.textContent()
  }

  async getDistanceText(): Promise<string | null> {
    return this.distanceValue.textContent()
  }
}
