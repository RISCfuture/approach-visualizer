import { type Locator, type Page } from '@playwright/test'

export class PositionSlider {
  readonly page: Page
  readonly slider: Locator
  readonly breakoutTick: Locator

  constructor(page: Page) {
    this.page = page
    this.slider = page.locator('.p-slider')
    this.breakoutTick = page.locator('.breakout-tick')
  }

  async getSliderBoundingBox() {
    return this.slider.boundingBox()
  }

  async dragToPercent(fromPercent: number, toPercent: number) {
    const box = await this.getSliderBoundingBox()
    if (!box) throw new Error('Slider bounding box not found')

    const centerY = box.y + box.height / 2
    await this.page.mouse.move(box.x + box.width * fromPercent, centerY)
    await this.page.mouse.down()
    // Use steps to generate intermediate mousemove events, which makes the
    // drag more reliable on slow CI runners where a single large jump can be
    // missed by the slider's event handler.
    await this.page.mouse.move(box.x + box.width * toPercent, centerY, { steps: 10 })
    await this.page.mouse.up()
  }

  async getBreakoutTickStyleAttribute(): Promise<string | null> {
    return this.breakoutTick.getAttribute('style')
  }
}
