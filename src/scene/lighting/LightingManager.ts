import * as BABYLON from 'babylonjs'
import type { LightingType } from '@/types/approach'
import { ApproachLightingSystem } from './ApproachLightingSystem'
import { ApproachLightingFactory } from './ApproachLightingFactory'
import { PAPISystem } from './PAPISystem'
import { REILSystem } from './REILSystem'
import { RCLSSystem } from './RCLSSystem'
import { RunwayEdgeLighting } from './RunwayEdgeLighting'
import { ALSFIISystem } from './systems/ALSFIISystem'

/**
 * Central manager for all lighting systems
 * Coordinates approach lights, runway lights, PAPI, REIL, RCLS, etc.
 */
export class LightingManager {
  private scene: BABYLON.Scene
  private glowLayer: BABYLON.GlowLayer | null = null

  // Lighting systems
  private approachLightingSystem: ApproachLightingSystem | null = null
  private papiSystem: PAPISystem | null = null
  private reilSystem: REILSystem | null = null
  private rclsSystem: RCLSSystem | null = null
  private runwayEdgeLighting: RunwayEdgeLighting | null = null

  // Sequenced flashing interval for approach lights
  private rabbitInterval: number | null = null

  // Configuration
  private isDarkMode: boolean = false
  private currentLightingType: LightingType = 'None'

  constructor(scene: BABYLON.Scene) {
    this.scene = scene
    this.checkDarkMode()
  }

  private checkDarkMode(): void {
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  private initializeGlowLayer(): void {
    if (!this.glowLayer) {
      this.glowLayer = new BABYLON.GlowLayer('glow', this.scene)
      this.glowLayer.intensity = this.isDarkMode ? 2.0 : 1.2
      this.glowLayer.blurKernelSize = 64
    }
  }

  /**
   * Updates all lighting based on configuration
   */
  updateLighting(config: {
    lightingType: LightingType
    showEdgeLights: boolean
    showPAPI: boolean
    showREIL: boolean
    showRCLS: boolean
  }): void {
    this.clearAllLights()
    this.currentLightingType = config.lightingType

    // Initialize glow layer if needed
    if (this.isDarkMode || config.lightingType !== 'None') {
      this.initializeGlowLayer()
    }

    // Create approach lighting system
    if (config.lightingType !== 'None') {
      this.approachLightingSystem = ApproachLightingFactory.create(
        config.lightingType,
        this.scene,
        this.glowLayer,
        { showPAPI: config.showPAPI },
      )

      if (this.approachLightingSystem) {
        this.approachLightingSystem.create()

        // Start sequenced flashers if the system has them
        const systemConfig = this.approachLightingSystem.getConfig()
        if (systemConfig.hasSequencedFlashers) {
          this.startRabbitSequence()
        }

        // Handle ALSF-II runway lights (touchdown zone lights)
        if (this.approachLightingSystem instanceof ALSFIISystem) {
          // ALSFIISystem has its own runway lights (TDZ lights)
          // These are handled internally by the system
        }
      }
    }

    // Create runway edge lighting
    if (config.showEdgeLights) {
      this.runwayEdgeLighting = new RunwayEdgeLighting(this.scene, this.glowLayer)
      this.runwayEdgeLighting.create(config.lightingType)
    }

    // Create PAPI
    if (config.showPAPI) {
      this.papiSystem = new PAPISystem(this.scene, this.glowLayer)
      this.papiSystem.create()
    }

    // Create REIL
    if (config.showREIL) {
      this.reilSystem = new REILSystem(this.scene, this.glowLayer)
      this.reilSystem.create()
      this.reilSystem.startFlashing()
    }

    // Create RCLS (Runway Centerline Lighting System)
    if (config.showRCLS) {
      this.rclsSystem = new RCLSSystem(this.scene, this.glowLayer)
      this.rclsSystem.create()
    }
  }

  /**
   * Updates PAPI lights based on aircraft position
   */
  updatePAPILights(currentAltitude: number, currentDistanceNm: number): void {
    if (this.papiSystem) {
      this.papiSystem.update(currentAltitude, currentDistanceNm)
    }
  }

  /**
   * Starts the rabbit sequence for sequenced flashers
   */
  private startRabbitSequence(): void {
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
      this.rabbitInterval = null
    }

    if (!this.approachLightingSystem) return

    const sequencedFlashers = this.approachLightingSystem.getSequencedFlashers()
    if (sequencedFlashers.length === 0) return

    let currentIndex = sequencedFlashers.length - 1

    // For 2 Hz (2 complete sequences per second), each sequence takes 500ms
    const sequenceTime = 500 // milliseconds for complete sequence
    const timePerLight = Math.floor(sequenceTime / Math.max(1, sequencedFlashers.length))

    this.rabbitInterval = setInterval(() => {
      sequencedFlashers.forEach((flasher) => {
        flasher.isVisible = false
      })

      const flasher = sequencedFlashers[currentIndex]
      if (flasher && currentIndex >= 0 && currentIndex < sequencedFlashers.length) {
        flasher.isVisible = true
      }

      currentIndex--
      if (currentIndex < 0) {
        currentIndex = sequencedFlashers.length - 1
      }
    }, timePerLight) as unknown as number
  }

  /**
   * Stops the rabbit sequence
   */
  private stopRabbitSequence(): void {
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
      this.rabbitInterval = null
    }
  }

  /**
   * Updates scene for dark/light mode changes
   */
  updateForDarkMode(isDarkMode: boolean): void {
    this.isDarkMode = isDarkMode

    if (this.glowLayer) {
      this.glowLayer.intensity = isDarkMode ? 2.5 : 1.2
    }
  }

  /**
   * Clears all lighting systems
   */
  private clearAllLights(): void {
    // Stop sequences
    this.stopRabbitSequence()

    // Dispose approach lighting
    if (this.approachLightingSystem) {
      this.approachLightingSystem.dispose()
      this.approachLightingSystem = null
    }

    // Dispose PAPI
    if (this.papiSystem) {
      this.papiSystem.dispose()
      this.papiSystem = null
    }

    // Dispose REIL
    if (this.reilSystem) {
      this.reilSystem.dispose()
      this.reilSystem = null
    }

    // Dispose RCLS
    if (this.rclsSystem) {
      this.rclsSystem.dispose()
      this.rclsSystem = null
    }

    // Dispose runway edge lighting
    if (this.runwayEdgeLighting) {
      this.runwayEdgeLighting.dispose()
      this.runwayEdgeLighting = null
    }
  }

  /**
   * Gets all approach lights
   */
  getApproachLights(): BABYLON.Mesh[] {
    return this.approachLightingSystem ? this.approachLightingSystem.getLights() : []
  }

  /**
   * Gets all runway lights (edge, threshold, end)
   */
  getRunwayLights(): BABYLON.Mesh[] {
    const lights: BABYLON.Mesh[] = []

    if (this.runwayEdgeLighting) {
      lights.push(...this.runwayEdgeLighting.getLights())
    }

    if (this.rclsSystem) {
      lights.push(...this.rclsSystem.getLights())
    }

    // Add ALSF-II TDZ lights if present
    if (this.approachLightingSystem instanceof ALSFIISystem) {
      lights.push(...this.approachLightingSystem.getRunwayLights())
    }

    return lights
  }

  /**
   * Gets PAPI lights
   */
  getPAPILights(): BABYLON.Mesh[] {
    return this.papiSystem ? this.papiSystem.getLights() : []
  }

  /**
   * Gets REIL lights
   */
  getREILLights(): BABYLON.Mesh[] {
    return this.reilSystem ? this.reilSystem.getLights() : []
  }

  /**
   * Disposes all lighting systems and resources
   */
  dispose(): void {
    this.clearAllLights()

    if (this.glowLayer) {
      this.glowLayer.dispose()
      this.glowLayer = null
    }
  }
}
