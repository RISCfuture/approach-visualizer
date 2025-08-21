import * as BABYLON from 'babylonjs'
import { SafeMeshBuilder } from '@/scene/utils/SafeMeshBuilder'
import {
  feetToMeters,
  RUNWAY_WIDTH_FT,
  TOUCHDOWN_ZONE_DISTANCE_FT,
  FEET_PER_NM,
} from '@/types/approach'

/**
 * PAPI: Precision Approach Path Indicator
 * Visual aid consisting of 4 lights that show red/white based on glidepath angle
 */
export class PAPISystem {
  private scene: BABYLON.Scene
  private papiLights: BABYLON.Mesh[] = []
  private papiRedMat: BABYLON.StandardMaterial | null = null
  private papiWhiteMat: BABYLON.StandardMaterial | null = null
  private glowLayer: BABYLON.GlowLayer | null = null

  constructor(scene: BABYLON.Scene, glowLayer: BABYLON.GlowLayer | null) {
    this.scene = scene
    this.glowLayer = glowLayer
    this.createMaterials()
  }

  private createMaterials(): void {
    // Dispose of existing materials if any
    SafeMeshBuilder.disposeMaterial(this.papiRedMat)
    SafeMeshBuilder.disposeMaterial(this.papiWhiteMat)

    this.papiRedMat = new BABYLON.StandardMaterial('papiRed', this.scene)
    this.papiRedMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.papiRedMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    this.papiWhiteMat = new BABYLON.StandardMaterial('papiWhite', this.scene)
    this.papiWhiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    this.papiWhiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
  }

  create(): void {
    // Check if scene is valid before creating meshes
    if (!SafeMeshBuilder.isSceneReady(this.scene)) {
      console.warn('Scene is not available or disposed, skipping PAPI lights creation')
      return
    }

    // Dispose of existing PAPI lights if any
    SafeMeshBuilder.disposeMeshes(this.papiLights)
    this.papiLights = []

    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    const papiSpacing = feetToMeters(30) // 30 ft between units
    const papiStartX = -(runwayWidthM / 2 + feetToMeters(50)) // 50 ft from runway edge
    const papiY = 2 // Height above ground
    const papiZ = tdzMeters // At touchdown zone

    // PAPI lights should be perpendicular to runway (varying X position)
    for (let i = 0; i < 4; i++) {
      const papi = SafeMeshBuilder.createSphere(
        `papi_${i}`,
        { diameter: 1.5, segments: 8 },
        this.scene,
      )

      if (papi) {
        papi.position.set(
          papiStartX - i * papiSpacing, // Vary X position
          papiY,
          papiZ, // Keep Z constant at touchdown zone
        )
        // Initially set to 2 red, 2 white (on glidepath)
        papi.material = i < 2 ? this.papiRedMat : this.papiWhiteMat

        if (this.glowLayer) {
          this.glowLayer.addIncludedOnlyMesh(papi)
        }

        this.papiLights.push(papi)
      }
    }
  }

  /**
   * Updates PAPI light colors based on current approach angle
   * @param currentAltitude Aircraft altitude in feet
   * @param currentDistanceNm Distance from threshold in nautical miles
   */
  update(currentAltitude: number, currentDistanceNm: number): void {
    if (this.papiLights.length !== 4 || !this.papiRedMat || !this.papiWhiteMat) return

    // Calculate current glidepath angle
    const distanceToTDZ = Math.max(0, currentDistanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM)
    const distanceFt = distanceToTDZ * FEET_PER_NM

    // Avoid division by zero
    if (distanceFt <= 0) return

    // Calculate angle in degrees
    const angleRadians = Math.atan(currentAltitude / distanceFt)
    const angleDegrees = (angleRadians * 180) / Math.PI

    // Determine PAPI configuration based on angle
    // PAPI angles: 2.5° (all red), 2.75° (1W 3R), 3.0° (2W 2R), 3.25° (3W 1R), 3.5° (all white)
    let redCount = 2 // Default to on glidepath

    if (angleDegrees >= 3.5) {
      redCount = 0 // All white - too high
    } else if (angleDegrees >= 3.25) {
      redCount = 1 // 3 white, 1 red - slightly high
    } else if (angleDegrees >= 2.75) {
      redCount = 2 // 2 white, 2 red - on glidepath
    } else if (angleDegrees >= 2.5) {
      redCount = 3 // 1 white, 3 red - slightly low
    } else {
      redCount = 4 // All red - too low
    }

    // Update light colors
    for (let i = 0; i < 4; i++) {
      this.papiLights[i].material = i < redCount ? this.papiRedMat : this.papiWhiteMat
    }
  }

  getLights(): BABYLON.Mesh[] {
    return this.papiLights
  }

  dispose(): void {
    SafeMeshBuilder.disposeMeshes(this.papiLights)
    this.papiLights = []

    SafeMeshBuilder.disposeMaterial(this.papiRedMat)
    SafeMeshBuilder.disposeMaterial(this.papiWhiteMat)
    this.papiRedMat = null
    this.papiWhiteMat = null
  }
}
