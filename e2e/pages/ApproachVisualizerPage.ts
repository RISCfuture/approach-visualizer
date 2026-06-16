import { type Locator, type Page } from '@playwright/test'
import { StatusOverlay } from '../components/StatusOverlay'
import { AnimationControls } from '../components/AnimationControls'
import { PositionSlider } from '../components/PositionSlider'

export class ApproachVisualizerPage {
  readonly page: Page
  readonly header: Locator
  readonly canvas: Locator
  readonly formFields: Locator
  readonly controls: Locator
  readonly approachMinimumLabel: Locator
  readonly statusOverlay: StatusOverlay
  readonly animationControls: AnimationControls
  readonly positionSlider: PositionSlider

  constructor(page: Page) {
    this.page = page
    this.header = page.locator('.app-header')
    this.canvas = page.locator('canvas.babylon-canvas')
    this.formFields = page.locator('.form-field')
    this.controls = page.locator('button, input, select')
    this.approachMinimumLabel = page.locator('label[for="approach-minimum"]')
    this.statusOverlay = new StatusOverlay(page)
    this.animationControls = new AnimationControls(page)
    this.positionSlider = new PositionSlider(page)
  }

  async goto() {
    await this.page.goto('/?testMode=true')
  }

  async waitForCanvasVisible(timeout = 5000) {
    await this.canvas.waitFor({ state: 'visible', timeout })
  }

  async waitForAutoPlay(timeout = 5000) {
    await this.animationControls.pauseButton.waitFor({ state: 'visible', timeout })
  }

  async takeScreenshot(path: string) {
    await this.page.screenshot({ path, fullPage: false })
  }

  async getFormFieldCount(): Promise<number> {
    return this.formFields.count()
  }

  async getControlCount(): Promise<number> {
    return this.controls.count()
  }

  async getFormFieldBoundingBox(index: number) {
    return this.formFields.nth(index).boundingBox()
  }

  getFormFieldAt(index: number): Locator {
    return this.formFields.nth(index)
  }
}
