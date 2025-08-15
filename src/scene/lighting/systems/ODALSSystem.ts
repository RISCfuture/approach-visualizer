import * as BABYLON from 'babylonjs'
import { ApproachLightingSystem, type LightingSystemConfig } from '../ApproachLightingSystem'
import { feetToMeters, RUNWAY_WIDTH_FT } from '@/types/approach'

/**
 * ODALS: Omnidirectional Approach Lighting System
 * 7 omnidirectional flashing lights for nonprecision runways
 */
export class ODALSSystem extends ApproachLightingSystem {
  private showPAPI: boolean

  constructor(
    scene: BABYLON.Scene,
    glowLayer: BABYLON.GlowLayer | null,
    showPAPI: boolean = false,
  ) {
    super(scene, glowLayer)
    this.showPAPI = showPAPI
  }

  create(): void {
    // 1. Five lights on runway centerline extended (300-1500 ft at 300 ft intervals)
    for (let ft = 300; ft <= 1500; ft += 300) {
      const z = -feetToMeters(ft)
      const odal = this.createLight(
        `odals_center_${ft}`,
        new BABYLON.Vector3(0, 3, z),
        this.strobeMat!,
        2, // Larger omnidirectional flasher
      )
      this.sequencedFlashers.push(odal)
      this.approachLights.push(odal)
    }

    // 2. Two lights on each side of threshold
    // 40 ft from runway edge (or 75 ft when VASI/PAPI equipped)
    const lateralDistance = this.showPAPI ? feetToMeters(75) : feetToMeters(40)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    for (let side = -1; side <= 1; side += 2) {
      const odal = this.createLight(
        `odals_threshold_${side}`,
        new BABYLON.Vector3(
          side * (runwayWidthM / 2 + lateralDistance), // Position from runway edge
          3,
          0, // At threshold
        ),
        this.strobeMat!,
        2, // Omnidirectional flasher
      )
      this.sequencedFlashers.push(odal)
      this.approachLights.push(odal)
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      hasSequencedFlashers: true, // All ODALS lights flash in sequence
      hasThresholdBar: false, // ODALS doesn't have a continuous threshold bar
      hasREIL: false, // ODALS is for non-precision runways
      systemLength: 1500,
    }
  }
}
