import * as BABYLON from 'babylonjs'
import { feetToMeters, RUNWAY_LENGTH_FT, RUNWAY_WIDTH_FT } from '@/types/approach'
import type { LightingType } from '@/types/approach'

/**
 * Runway Edge Lighting System
 * Includes edge lights, threshold lights, and runway end lights
 */
export class RunwayEdgeLighting {
  private scene: BABYLON.Scene
  private edgeLights: BABYLON.Mesh[] = []
  private glowLayer: BABYLON.GlowLayer | null = null

  // Materials
  private whiteMat: BABYLON.StandardMaterial | null = null
  private yellowMat: BABYLON.StandardMaterial | null = null
  private greenMat: BABYLON.StandardMaterial | null = null
  private redMat: BABYLON.StandardMaterial | null = null

  constructor(scene: BABYLON.Scene, glowLayer: BABYLON.GlowLayer | null) {
    this.scene = scene
    this.glowLayer = glowLayer
    this.createMaterials()
  }

  private createMaterials(): void {
    this.whiteMat = new BABYLON.StandardMaterial('whiteLight', this.scene)
    this.whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    this.whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    this.yellowMat = new BABYLON.StandardMaterial('yellowLight', this.scene)
    this.yellowMat.emissiveColor = new BABYLON.Color3(1, 1, 0)
    this.yellowMat.diffuseColor = new BABYLON.Color3(1, 1, 0)

    this.greenMat = new BABYLON.StandardMaterial('greenLight', this.scene)
    this.greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
    this.greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)

    this.redMat = new BABYLON.StandardMaterial('redLight', this.scene)
    this.redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)
  }

  create(lightingType?: LightingType): void {
    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    // Create edge lights
    this.createEdgeLights(runwayLengthM, runwayWidthM)

    // Create threshold lights (unless the approach lighting system has its own)
    const hasOwnThresholdBar =
      lightingType &&
      ['ALSF-II', 'ALSF-I', 'SSALR', 'MALS', 'MALSF', 'MALSR'].includes(lightingType)

    if (!hasOwnThresholdBar) {
      this.createThresholdLights(runwayWidthM)
    }

    // Create runway end lights
    this.createEndLights(runwayLengthM, runwayWidthM)
  }

  private createEdgeLights(runwayLengthM: number, runwayWidthM: number): void {
    const lightSpacing = 60 // meters between lights

    // Calculate caution zone length (last 2000 ft or half runway, whichever is less)
    const cautionZoneLengthFt = Math.min(2000, RUNWAY_LENGTH_FT / 2)
    const cautionZoneStartM = runwayLengthM - feetToMeters(cautionZoneLengthFt)

    const numLights = Math.floor(runwayLengthM / lightSpacing)

    for (let i = 0; i <= numLights; i++) {
      const z = i * lightSpacing
      let material = this.whiteMat

      // Yellow caution zone for last portion of runway
      if (z >= cautionZoneStartM) {
        material = this.yellowMat
      }

      // Create lights on both sides of runway
      for (let side = -1; side <= 1; side += 2) {
        const light = BABYLON.MeshBuilder.CreateSphere(
          `runwayEdge_${side}_${i}`,
          { diameter: 0.5, segments: 8 },
          this.scene,
        )
        light.position.x = side * (runwayWidthM / 2 + 3) // 3 meters outside runway edge
        light.position.z = z
        light.position.y = 1 // Height above ground
        light.material = material!

        if (this.glowLayer) {
          this.glowLayer.addIncludedOnlyMesh(light)
        }

        this.edgeLights.push(light)
      }
    }
  }

  private createThresholdLights(runwayWidthM: number): void {
    // Green threshold lights across runway width
    for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
      const thresholdLight = BABYLON.MeshBuilder.CreateSphere(
        `threshold_${x}`,
        { diameter: 0.8, segments: 8 },
        this.scene,
      )
      thresholdLight.position.set(x, 1, 5) // 5 meters from threshold
      thresholdLight.material = this.greenMat!

      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(thresholdLight)
      }

      this.edgeLights.push(thresholdLight)
    }
  }

  private createEndLights(runwayLengthM: number, runwayWidthM: number): void {
    // Red runway end lights (for departing aircraft)
    for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
      const endLight = BABYLON.MeshBuilder.CreateSphere(
        `end_${x}`,
        { diameter: 0.8, segments: 8 },
        this.scene,
      )
      endLight.position.set(x, 1, runwayLengthM - 5) // 5 meters from end
      endLight.material = this.redMat!

      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(endLight)
      }

      this.edgeLights.push(endLight)
    }
  }

  getLights(): BABYLON.Mesh[] {
    return this.edgeLights
  }

  dispose(): void {
    this.edgeLights.forEach((light) => light.dispose())
    this.edgeLights = []

    this.whiteMat?.dispose()
    this.yellowMat?.dispose()
    this.greenMat?.dispose()
    this.redMat?.dispose()
  }
}
