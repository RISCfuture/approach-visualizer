import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import App from '../App.vue'

describe('App', () => {
  it('renders properly', () => {
    const wrapper = shallowMount(App, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })
    expect(wrapper.find('.app').exists()).toBe(true)
    expect(wrapper.find('.main-content').exists()).toBe(true)
  })
})
