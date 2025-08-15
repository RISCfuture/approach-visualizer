import * as BABYLON from 'babylonjs'
import { feetToMeters, RUNWAY_LENGTH_FT } from '@/types/approach'

/**
 * RCLS: Runway Centerline Lighting System
 * Embedded lights along the runway centerline for low visibility operations
 */
export class RCLSSystem {
  private scene: BABYLON.Scene
  private rclsLights: BABYLON.Mesh[] = []
  private glowLayer: BABYLON.GlowLayer | null = null
  private whiteMat: BABYLON.StandardMaterial | null = null
  private redMat: BABYLON.StandardMaterial | null = null
  private alternateMat: BABYLON.StandardMaterial | null = null

  constructor(scene: BABYLON.Scene, glowLayer: BABYLON.GlowLayer | null) {
    this.scene = scene
    this.glowLayer = glowLayer
    this.createMaterials()
  }

  private createMaterials(): void {
    this.whiteMat = new BABYLON.StandardMaterial('rclsWhite', this.scene)
    this.whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    this.whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    this.redMat = new BABYLON.StandardMaterial('rclsRed', this.scene)
    this.redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    this.alternateMat = new BABYLON.StandardMaterial('rclsAlternate', this.scene)
    this.alternateMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    this.alternateMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
  }

  create(): void {
    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)

    // RCLS lights are spaced at 50 ft intervals along the centerline
    const spacingFt = 50
    const spacingM = feetToMeters(spacingFt)

    // Color coding:
    // - Last 1000 ft: alternating red/white
    // - Next 2000 ft (1000-3000 ft from end): all white
    // - Remaining: white
    const last1000ftM = feetToMeters(1000)
    const last3000ftM = feetToMeters(3000)

    for (let i = 0; i * spacingM <= runwayLengthM; i++) {
      const z = i * spacingM
      const distanceFromEnd = runwayLengthM - z

      let material = this.whiteMat

      if (distanceFromEnd <= last1000ftM) {
        // Last 1000 ft: alternating red/white
        material = i % 2 === 0 ? this.redMat : this.alternateMat
      } else if (distanceFromEnd <= last3000ftM) {
        // Last 3000 ft (but not the final 1000): all white
        material = this.whiteMat
      }

      const light = BABYLON.MeshBuilder.CreateSphere(
        `rcls_${i}`,
        { diameter: 0.3, segments: 6 },
        this.scene,
      )
      light.position.set(0, 0.1, z) // Embedded in runway surface
      light.material = material!

      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }

      this.rclsLights.push(light)
    }
  }

  getLights(): BABYLON.Mesh[] {
    return this.rclsLights
  }

  dispose(): void {
    this.rclsLights.forEach((light) => light.dispose())
    this.rclsLights = []

    this.whiteMat?.dispose()
    this.redMat?.dispose()
    this.alternateMat?.dispose()
  }
}
