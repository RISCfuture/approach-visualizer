import { test as base } from '@playwright/test'
import { ApproachVisualizerPage } from '../pages/ApproachVisualizerPage'
import { WebGLErrorPage } from '../pages/WebGLErrorPage'

type Fixtures = {
  approachPage: ApproachVisualizerPage
  webGLErrorPage: WebGLErrorPage
}

export const test = base.extend<Fixtures>({
  approachPage: async ({ page }, use) => {
    await use(new ApproachVisualizerPage(page))
  },
  webGLErrorPage: async ({ page }, use) => {
    await use(new WebGLErrorPage(page))
  },
})

export { expect } from '@playwright/test'
