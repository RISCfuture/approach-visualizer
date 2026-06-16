import { test as base } from '@playwright/test'
import { ApproachVisualizerPage } from '../pages/ApproachVisualizerPage'
import { WebGLErrorPage } from '../pages/WebGLErrorPage'

/**
 * Init script that forces every WebGL context creation to fail, so the app
 * falls back to its "WebGL Not Supported" error UI. Injected by the
 * webGLDisabledErrorPage fixture before the page navigates.
 */
const webGLDisableScript = () => {
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

type Fixtures = {
  approachPage: ApproachVisualizerPage
  webGLErrorPage: WebGLErrorPage
  webGLDisabledErrorPage: WebGLErrorPage
}

export const test = base.extend<Fixtures>({
  approachPage: async ({ page }, use) => {
    await use(new ApproachVisualizerPage(page))
  },
  webGLErrorPage: async ({ page }, use) => {
    await use(new WebGLErrorPage(page))
  },
  /**
   * A WebGLErrorPage backed by a context in which WebGL is disabled, already
   * navigated to the app. The fixture owns the context lifecycle (creation,
   * the WebGL-disable init script, and teardown); specs only assert. Honors
   * the active `viewport` and `browserName` test options, so a spec can
   * exercise the mobile layout via `test.use({ viewport })`.
   */
  webGLDisabledErrorPage: async ({ browser, browserName, viewport }, use) => {
    const context = await browser.newContext({
      ...(viewport ? { viewport } : {}),
      ...(browserName === 'chromium' && {
        args: ['--disable-webgl', '--disable-webgl2'],
      }),
    })
    const page = await context.newPage()
    await page.addInitScript(webGLDisableScript)

    const errorPage = new WebGLErrorPage(page)
    await errorPage.goto()

    await use(errorPage)

    await context.close()
  },
})

export { expect } from '@playwright/test'
