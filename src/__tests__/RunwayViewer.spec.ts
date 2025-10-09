import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import RunwayViewer from '../components/RunwayViewer.vue'
import { SceneManager } from '../scene/SceneManager'

// Mock the SceneManager module
vi.mock('../scene/SceneManager', () => {
  return {
    SceneManager: vi.fn(),
  }
})

// Mock BABYLON.Engine.isSupported
vi.mock('babylonjs', () => ({
  Engine: {
    isSupported: vi.fn(() => true),
  },
}))

interface MockSceneManager {
  updateSettings: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

describe('RunwayViewer', () => {
  let mockSceneManager: MockSceneManager

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create a mock SceneManager instance
    mockSceneManager = {
      updateSettings: vi.fn(),
      dispose: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders properly when WebGL is supported', async () => {
    // Mock successful SceneManager creation
    ;(SceneManager as ReturnType<typeof vi.fn>).mockImplementation(() => mockSceneManager)

    const wrapper = mount(RunwayViewer, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })

    // Wait for mounted lifecycle
    await wrapper.vm.$nextTick()

    // Check that the canvas is rendered
    expect(wrapper.find('canvas.babylon-canvas').exists()).toBe(true)

    // Check that status overlay is shown (not the error)
    expect(wrapper.find('.status-overlay').exists()).toBe(true)
    expect(wrapper.find('.webgl-error').exists()).toBe(false)

    // Check that SceneManager was created
    expect(SceneManager).toHaveBeenCalledTimes(1)
  })

  it('displays error message when WebGL is not supported', async () => {
    // Mock SceneManager constructor to throw an error
    ;(SceneManager as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('WebGL is not supported')
    })

    const wrapper = mount(RunwayViewer, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })

    // Wait for mounted lifecycle
    await wrapper.vm.$nextTick()

    // Check that the error message is displayed
    expect(wrapper.find('.webgl-error').exists()).toBe(true)
    expect(wrapper.find('.error-content h3').text()).toBe('WebGL Not Supported')

    // Check that status overlay is not shown
    expect(wrapper.find('.status-overlay').exists()).toBe(false)

    // Check that suggestions are displayed
    const suggestions = wrapper.findAll('.suggestions li')
    expect(suggestions.length).toBe(4)
    expect(suggestions[0]?.text()).toContain('Using a modern browser')
    expect(suggestions[1]?.text()).toContain('Enabling hardware acceleration')
    expect(suggestions[2]?.text()).toContain('Updating your graphics drivers')
    expect(suggestions[3]?.text()).toContain('WebGL is blocked')
  })

  it('properly disposes SceneManager on unmount', async () => {
    // Mock successful SceneManager creation
    ;(SceneManager as ReturnType<typeof vi.fn>).mockImplementation(() => mockSceneManager)

    const wrapper = mount(RunwayViewer, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })

    // Wait for mounted lifecycle
    await wrapper.vm.$nextTick()

    // Unmount the component
    wrapper.unmount()

    // Check that dispose was called
    expect(mockSceneManager.dispose).toHaveBeenCalledTimes(1)
  })

  it('does not call dispose when SceneManager creation fails', async () => {
    // Mock SceneManager constructor to throw an error
    ;(SceneManager as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('WebGL is not supported')
    })

    const wrapper = mount(RunwayViewer, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })

    // Wait for mounted lifecycle
    await wrapper.vm.$nextTick()

    // Unmount the component
    wrapper.unmount()

    // Since SceneManager creation failed, dispose should not be called
    expect(mockSceneManager.dispose).not.toHaveBeenCalled()
  })

  it('logs error to console when WebGL initialization fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock SceneManager constructor to throw an error
    ;(SceneManager as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('WebGL is not supported')
    })

    mount(RunwayViewer, {
      global: {
        plugins: [createPinia(), [PrimeVue, { theme: { preset: Aura } }]],
      },
    })

    // Wait for mounted lifecycle
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Check that error was logged
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
      'Failed to initialize 3D scene:',
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })
})
