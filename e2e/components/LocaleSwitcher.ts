import { type Locator, type Page } from '@playwright/test'

/**
 * The nondescript globe button + popup menu used to change the UI language.
 * Selectors are locale-independent: the trigger is matched by class (its
 * aria-label is itself translated) and menu items by their endonym labels,
 * which stay constant regardless of the active locale.
 */
export class LocaleSwitcher {
  readonly page: Page
  readonly trigger: Locator

  constructor(page: Page) {
    this.page = page
    this.trigger = page.locator('.locale-switcher button')
  }

  async open() {
    await this.trigger.click()
  }

  async choose(endonym: string) {
    await this.open()
    await this.page.getByRole('menuitem', { name: endonym, exact: true }).click()
  }
}
