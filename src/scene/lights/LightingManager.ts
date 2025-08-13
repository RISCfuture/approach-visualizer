import * as BABYLON from 'babylonjs'
import type { LightingType } from '@/types/approach'
import { feetToMeters, RUNWAY_LENGTH_FT, RUNWAY_WIDTH_FT } from '@/types/approach'

export class LightingManager {
  private scene: BABYLON.Scene
  private approachLights: BABYLON.Mesh[] = []
  private runwayLights: BABYLON.Mesh[] = []
  private reilLights: BABYLON.Mesh[] = []
  private papiLights: BABYLON.Mesh[] = []
  private sequencedFlashers: BABYLON.Mesh[] = []
  private reilFlashInterval: number | null = null
  private rabbitInterval: number | null = null
  private papiRedMat: BABYLON.StandardMaterial | null = null
  private papiWhiteMat: BABYLON.StandardMaterial | null = null
  private glowLayer: BABYLON.GlowLayer | null = null

  constructor(scene: BABYLON.Scene) {
    this.scene = scene
  }

  clearLights(): void {
    // Clear approach lights
    this.approachLights.forEach((light) => light.dispose())
    this.approachLights = []

    // Clear REIL lights
    this.reilLights.forEach((light) => light.dispose())
    this.reilLights = []
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
      this.reilFlashInterval = null
    }

    // Clear rabbit sequence
    this.sequencedFlashers = []
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
      this.rabbitInterval = null
    }

    // Clear runway lights
    this.runwayLights.forEach((light) => light.dispose())
    this.runwayLights = []

    // Clear PAPI lights
    this.papiLights.forEach((light) => light.dispose())
    this.papiLights = []
  }

  createRunwayEdgeLights(isDarkMode: boolean): void {
    const runwayLength = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidth = feetToMeters(RUNWAY_WIDTH_FT)
    const lightSpacing = 60 // meters between lights
    const numLights = Math.floor(runwayLength / lightSpacing)

    // Create material for runway edge lights
    const edgeLightMat = new BABYLON.StandardMaterial('edgeLight', this.scene)
    edgeLightMat.emissiveColor = new BABYLON.Color3(1, 1, 0.8) // Warm white
    edgeLightMat.specularColor = new BABYLON.Color3(0, 0, 0)

    // Enable glow effect for night mode
    if (isDarkMode && !this.glowLayer) {
      this.glowLayer = new BABYLON.GlowLayer('glow', this.scene)
      this.glowLayer.intensity = 0.5
    }

    for (let i = 0; i <= numLights; i++) {
      const zPos = -runwayLength / 2 + i * lightSpacing

      // Left edge light
      const leftLight = BABYLON.MeshBuilder.CreateSphere(
        'leftEdgeLight',
        { diameter: isDarkMode ? 0.5 : 0.3 },
        this.scene,
      )
      leftLight.position = new BABYLON.Vector3(-runwayWidth / 2 - 1, 0.2, zPos)
      leftLight.material = edgeLightMat

      // Right edge light
      const rightLight = BABYLON.MeshBuilder.CreateSphere(
        'rightEdgeLight',
        { diameter: isDarkMode ? 0.5 : 0.3 },
        this.scene,
      )
      rightLight.position = new BABYLON.Vector3(runwayWidth / 2 + 1, 0.2, zPos)
      rightLight.material = edgeLightMat

      this.runwayLights.push(leftLight, rightLight)

      // Add glow in dark mode
      if (isDarkMode && this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(leftLight)
        this.glowLayer.addIncludedOnlyMesh(rightLight)
      }
    }

    // Threshold lights (green)
    const thresholdMat = new BABYLON.StandardMaterial('thresholdLight', this.scene)
    thresholdMat.emissiveColor = new BABYLON.Color3(0, 1, 0) // Green
    thresholdMat.specularColor = new BABYLON.Color3(0, 0, 0)

    const thresholdLightSpacing = 3 // meters
    const numThresholdLights = Math.floor(runwayWidth / thresholdLightSpacing)

    for (let i = 0; i <= numThresholdLights; i++) {
      const xPos = -runwayWidth / 2 + i * thresholdLightSpacing
      const light = BABYLON.MeshBuilder.CreateSphere(
        'thresholdLight',
        { diameter: isDarkMode ? 0.5 : 0.3 },
        this.scene,
      )
      light.position = new BABYLON.Vector3(xPos, 0.2, runwayLength / 2)
      light.material = thresholdMat
      this.runwayLights.push(light)

      if (isDarkMode && this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }
    }

    // End lights (red)
    const endMat = new BABYLON.StandardMaterial('endLight', this.scene)
    endMat.emissiveColor = new BABYLON.Color3(1, 0, 0) // Red
    endMat.specularColor = new BABYLON.Color3(0, 0, 0)

    for (let i = 0; i <= numThresholdLights; i++) {
      const xPos = -runwayWidth / 2 + i * thresholdLightSpacing
      const light = BABYLON.MeshBuilder.CreateSphere(
        'endLight',
        { diameter: isDarkMode ? 0.5 : 0.3 },
        this.scene,
      )
      light.position = new BABYLON.Vector3(xPos, 0.2, -runwayLength / 2)
      light.material = endMat
      this.runwayLights.push(light)

      if (isDarkMode && this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }
    }
  }

  createPAPILights(isDarkMode: boolean): void {
    // PAPI is typically located about 300m from threshold on left side
    const papiDistance = 300 // meters from threshold
    const papiSpacing = 9 // meters between units
    const runwayWidth = feetToMeters(RUNWAY_WIDTH_FT)
    const runwayLength = feetToMeters(RUNWAY_LENGTH_FT)

    // Create materials
    this.papiRedMat = new BABYLON.StandardMaterial('papiRed', this.scene)
    this.papiRedMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.papiRedMat.specularColor = new BABYLON.Color3(0, 0, 0)

    this.papiWhiteMat = new BABYLON.StandardMaterial('papiWhite', this.scene)
    this.papiWhiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    this.papiWhiteMat.specularColor = new BABYLON.Color3(0, 0, 0)

    // Create 4 PAPI units on left side of runway
    for (let i = 0; i < 4; i++) {
      const box = BABYLON.MeshBuilder.CreateBox(
        `papi${i}`,
        { width: 3, height: 2, depth: 1 },
        this.scene,
      )
      box.position = new BABYLON.Vector3(
        -runwayWidth / 2 - 20 - i * papiSpacing, // Left of runway
        1, // Slightly above ground
        runwayLength / 2 - papiDistance, // Distance from threshold
      )
      box.material = this.papiRedMat // Start with all red (too low)
      this.papiLights.push(box)

      if (isDarkMode && this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(box)
      }
    }
  }

  updatePAPILights(currentAltitude: number, currentDistanceNm: number): void {
    if (!this.papiRedMat || !this.papiWhiteMat || this.papiLights.length === 0) return

    // Calculate glidepath angle
    const distanceFt = currentDistanceNm * 6076
    const angleRadians = Math.atan(currentAltitude / distanceFt)
    const angleDegrees = (angleRadians * 180) / Math.PI

    // PAPI shows:
    // All white: > 3.5° (too high)
    // 3 white, 1 red: 3.2° - 3.5°
    // 2 white, 2 red: 2.8° - 3.2° (on glidepath)
    // 1 white, 3 red: 2.5° - 2.8°
    // All red: < 2.5° (too low)

    let numWhite = 0
    if (angleDegrees > 3.5) {
      numWhite = 4
    } else if (angleDegrees > 3.2) {
      numWhite = 3
    } else if (angleDegrees > 2.8) {
      numWhite = 2
    } else if (angleDegrees > 2.5) {
      numWhite = 1
    }

    // Update light colors (leftmost lights show white when high)
    this.papiLights.forEach((light, index) => {
      light.material = index < numWhite ? this.papiWhiteMat : this.papiRedMat
    })
  }

  startREILFlashing(): void {
    if (this.reilFlashInterval) return

    let flashState = false
    this.reilFlashInterval = window.setInterval(() => {
      flashState = !flashState
      this.reilLights.forEach((light) => {
        light.setEnabled(flashState)
      })
    }, 500) // Flash every 500ms
  }

  stopREILFlashing(): void {
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
      this.reilFlashInterval = null
    }
  }

  startRabbitSequence(): void {
    if (this.rabbitInterval || this.sequencedFlashers.length === 0) return

    let currentIndex = 0
    this.rabbitInterval = window.setInterval(() => {
      // Turn off all flashers
      this.sequencedFlashers.forEach((f) => f.setEnabled(false))

      // Turn on current pair
      if (currentIndex < this.sequencedFlashers.length / 2) {
        const leftIndex = currentIndex
        const rightIndex = this.sequencedFlashers.length / 2 + currentIndex
        this.sequencedFlashers[leftIndex].setEnabled(true)
        this.sequencedFlashers[rightIndex].setEnabled(true)
      }

      currentIndex = (currentIndex + 1) % (this.sequencedFlashers.length / 2 + 1)
    }, 120) // Sequence every 120ms for smooth rabbit effect
  }

  stopRabbitSequence(): void {
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
      this.rabbitInterval = null
    }
  }

  getApproachLights(): BABYLON.Mesh[] {
    return this.approachLights
  }

  getRunwayLights(): BABYLON.Mesh[] {
    return this.runwayLights
  }

  getPAPILights(): BABYLON.Mesh[] {
    return this.papiLights
  }

  getREILLights(): BABYLON.Mesh[] {
    return this.reilLights
  }

  dispose(): void {
    this.clearLights()
    if (this.glowLayer) {
      this.glowLayer.dispose()
      this.glowLayer = null
    }
  }

  // This method will be implemented from the main SceneManager
  createApproachLights(_type: LightingType, _isDarkMode: boolean): void {
    // Implementation will be moved here from SceneManager
    // For now, keeping it in SceneManager due to complexity
  }
}
