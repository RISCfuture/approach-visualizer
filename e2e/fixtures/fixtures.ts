import { test as base } from '@playwright/test'
import { ApproachVisualizerPage } from '../pages/ApproachVisualizerPage'
import { WebGLErrorPage } from '../pages/WebGLErrorPage'

/**
 * Init script that forces every WebGL context request to fail, so the app
 * falls back to its "WebGL Not Supported" error state. Defined as a string
 * because it is serialized and evaluated in the browser via addInitScript.
 */
const disableWebGL = () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextType: string,
    ...args: unknown[]
  ): RenderingContext | null {
    if (
      contextType === 'webgl' ||
      contextType === 'webgl2' ||
      contextType === 'experimental-webgl' ||
      contextType === 'experimental-webgl2'
    ) {
      return null
    }
    return originalGetContext.apply(this, [contextType, ...args] as Parameters<
      typeof originalGetContext
    >) as RenderingContext | null
  }

  if (typeof WebGLRenderingContext !== 'undefined') {
    ;(window as Window & { WebGLRenderingContext?: undefined }).WebGLRenderingContext = undefined
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    ;(window as Window & { WebGL2RenderingContext?: undefined }).WebGL2RenderingContext = undefined
  }
}

type Options = {
  /**
   * When true, WebGL context creation is forced to fail before any navigation,
   * driving the app into its WebGL error state. Opt in per test with
   * `test.use({ webGLDisabled: true })`.
   */
  webGLDisabled: boolean
}

type Fixtures = {
  approachPage: ApproachVisualizerPage
  webGLErrorPage: WebGLErrorPage
}

export const test = base.extend<Options & Fixtures>({
  webGLDisabled: [false, { option: true }],
  page: async ({ page, webGLDisabled }, use) => {
    if (webGLDisabled) {
      await page.addInitScript(disableWebGL)
    }
    await use(page)
  },
  approachPage: async ({ page }, use) => {
    await use(new ApproachVisualizerPage(page))
  },
  webGLErrorPage: async ({ page }, use) => {
    await use(new WebGLErrorPage(page))
  },
})

export { expect } from '@playwright/test'
