import * as BABYLON from 'babylonjs'
import { feetToMeters, RUNWAY_WIDTH_FT } from '@/types/approach'

/**
 * REIL: Runway End Identifier Lights
 * Synchronized flashing lights on each side of runway threshold
 */
export class REILSystem {
  private scene: BABYLON.Scene
  private reilLights: BABYLON.Mesh[] = []
  private reilFlashInterval: number | null = null
  private glowLayer: BABYLON.GlowLayer | null = null
  private strobeMat: BABYLON.StandardMaterial | null = null

  constructor(scene: BABYLON.Scene, glowLayer: BABYLON.GlowLayer | null) {
    this.scene = scene
    this.glowLayer = glowLayer
    this.createMaterial()
  }

  private createMaterial(): void {
    this.strobeMat = new BABYLON.StandardMaterial('reilStrobe', this.scene)
    this.strobeMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    this.strobeMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
  }

  create(): void {
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    // Create two REIL lights, one on each side of the runway threshold
    for (let side = -1; side <= 1; side += 2) {
      const reil = BABYLON.MeshBuilder.CreateSphere(
        `reil_${side}`,
        { diameter: 2, segments: 8 },
        this.scene,
      )
      // Position 10 meters outside runway edge, 30 meters before threshold
      reil.position.set(
        side * (runwayWidthM / 2 + 10),
        3, // Height above ground
        -30, // Before threshold
      )
      reil.material = this.strobeMat

      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(reil)
      }

      this.reilLights.push(reil)
    }
  }

  /**
   * Starts the REIL flashing sequence
   * REILs flash at 2 Hz (twice per second)
   */
  startFlashing(): void {
    // Clear any existing interval
    this.stopFlashing()

    // Flash REILs at 2Hz (twice per second) by toggling visibility and glow
    let visible = true
    this.reilFlashInterval = setInterval(() => {
      this.reilLights.forEach((light) => {
        light.isVisible = visible
        // Also remove/add from glow layer for complete flash effect
        if (this.glowLayer) {
          if (visible) {
            this.glowLayer.addIncludedOnlyMesh(light)
          } else {
            this.glowLayer.removeIncludedOnlyMesh(light)
          }
        }
      })
      visible = !visible
    }, 250) as unknown as number // 250ms = 4 changes per second = 2 Hz
  }

  /**
   * Stops the REIL flashing sequence
   */
  stopFlashing(): void {
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
      this.reilFlashInterval = null
    }
    // Ensure lights are visible when stopped
    this.reilLights.forEach((light) => {
      light.isVisible = true
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }
    })
  }

  getLights(): BABYLON.Mesh[] {
    return this.reilLights
  }

  dispose(): void {
    this.stopFlashing()
    this.reilLights.forEach((light) => light.dispose())
    this.reilLights = []
    this.strobeMat?.dispose()
  }
}
