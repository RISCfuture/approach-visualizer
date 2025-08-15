import * as BABYLON from 'babylonjs'
import { feetToMeters, RUNWAY_WIDTH_FT } from '@/types/approach'

export interface LightingSystemConfig {
  hasSequencedFlashers: boolean
  hasThresholdBar: boolean
  hasREIL: boolean
  systemLength: number // in feet
}

export abstract class ApproachLightingSystem {
  protected scene: BABYLON.Scene
  protected approachLights: BABYLON.Mesh[] = []
  protected sequencedFlashers: BABYLON.Mesh[] = []
  protected glowLayer: BABYLON.GlowLayer | null = null
  protected runwayWidthM: number

  // Common materials
  protected whiteMat: BABYLON.StandardMaterial | null = null
  protected redMat: BABYLON.StandardMaterial | null = null
  protected greenMat: BABYLON.StandardMaterial | null = null
  protected strobeMat: BABYLON.StandardMaterial | null = null

  constructor(scene: BABYLON.Scene, glowLayer: BABYLON.GlowLayer | null) {
    this.scene = scene
    this.glowLayer = glowLayer
    this.runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    this.createMaterials()
  }

  protected createMaterials(): void {
    // White approach light material
    this.whiteMat = new BABYLON.StandardMaterial('approachWhite', this.scene)
    this.whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    this.whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    // Red light material
    this.redMat = new BABYLON.StandardMaterial('approachRed', this.scene)
    this.redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    // Green threshold light material
    this.greenMat = new BABYLON.StandardMaterial('thresholdGreen', this.scene)
    this.greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
    this.greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)

    // Strobe/sequenced flasher material
    this.strobeMat = new BABYLON.StandardMaterial('strobe', this.scene)
    this.strobeMat.emissiveColor = new BABYLON.Color3(1, 1, 0.9)
    this.strobeMat.diffuseColor = new BABYLON.Color3(1, 1, 0.9)
  }

  protected createLight(
    name: string,
    position: BABYLON.Vector3,
    material: BABYLON.StandardMaterial,
    diameter: number = 0.6,
  ): BABYLON.Mesh {
    const light = BABYLON.MeshBuilder.CreateSphere(name, { diameter, segments: 8 }, this.scene)
    light.position = position
    light.material = material

    if (this.glowLayer) {
      this.glowLayer.addIncludedOnlyMesh(light)
    }

    return light
  }

  protected createCenterlineBar(
    prefix: string,
    z: number,
    numLights: number = 5,
    spacing: number = 3.5, // feet between lights
  ): void {
    const spacingM = feetToMeters(spacing)
    const startX = (-(numLights - 1) * spacingM) / 2

    for (let i = 0; i < numLights; i++) {
      const x = startX + i * spacingM
      const light = this.createLight(
        `${prefix}_${i}`,
        new BABYLON.Vector3(x, 2, z),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }
  }

  protected createThresholdBar(
    extensionFt: number = 45, // Extension beyond runway edge on each side
  ): void {
    const thresholdBarWidth = this.runwayWidthM + feetToMeters(extensionFt * 2)
    const thresholdLightSpacing = feetToMeters(5) // 5 ft centers per spec
    const numThresholdLights = Math.floor(thresholdBarWidth / thresholdLightSpacing)

    for (let i = 0; i <= numThresholdLights; i++) {
      const x = -thresholdBarWidth / 2 + i * thresholdLightSpacing
      const light = this.createLight(
        `threshold_${i}`,
        new BABYLON.Vector3(x, 1, 0),
        this.greenMat!,
        0.8,
      )
      this.approachLights.push(light)
    }
  }

  protected createSequencedFlasher(name: string, position: BABYLON.Vector3): BABYLON.Mesh {
    const flasher = this.createLight(name, position, this.strobeMat!, 1.5)
    this.sequencedFlashers.push(flasher)
    this.approachLights.push(flasher)
    return flasher
  }

  // Abstract method that each lighting system must implement
  abstract create(): void
  abstract getConfig(): LightingSystemConfig

  // Common methods
  public getLights(): BABYLON.Mesh[] {
    return this.approachLights
  }

  public getSequencedFlashers(): BABYLON.Mesh[] {
    return this.sequencedFlashers
  }

  public dispose(): void {
    this.approachLights.forEach((light) => light.dispose())
    this.approachLights = []
    this.sequencedFlashers = []

    // Dispose materials
    this.whiteMat?.dispose()
    this.redMat?.dispose()
    this.greenMat?.dispose()
    this.strobeMat?.dispose()
  }
}
