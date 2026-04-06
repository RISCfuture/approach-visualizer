import { type Locator, type Page } from '@playwright/test'

export class AnimationControls {
  readonly page: Page
  readonly playButton: Locator
  readonly pauseButton: Locator
  readonly resumeButton: Locator
  readonly resetButton: Locator

  constructor(page: Page) {
    this.page = page
    this.playButton = page.getByRole('button', { name: /play/i })
    this.pauseButton = page.getByRole('button', { name: /pause/i })
    this.resumeButton = page.getByRole('button', { name: /resume/i })
    this.resetButton = page.getByRole('button', { name: /reset/i })
  }

  async play() {
    await this.playButton.click()
  }

  async pause() {
    await this.pauseButton.click()
  }

  async resume() {
    await this.resumeButton.click()
  }

  async reset() {
    await this.resetButton.click()
  }

  async pressSpacebar() {
    await this.page.keyboard.press(' ')
  }
}
