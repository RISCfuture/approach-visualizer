import * as BABYLON from 'babylonjs'
import { ApproachLightingSystem, type LightingSystemConfig } from '../ApproachLightingSystem'
import { feetToMeters } from '@/types/approach'

/**
 * SSALR: Simplified Short Approach Lighting System with RAIL
 * Operated as a subsystem of ALSF-2
 */
export class SSALRSystem extends ApproachLightingSystem {
  create(): void {
    // 1. Seven five-light centerline bars from 200 to 1400 ft at 200 ft intervals
    this.createCenterlineBars()

    // 2. Green threshold bar - lights on 10 ft centers across runway
    this.createSSALRThresholdBar()

    // 3. RAIL sequenced flashers - 5 flashers from 1600 to 2400 ft
    this.createRAILFlashers()
  }

  private createCenterlineBars(): void {
    for (let ft = 200; ft <= 1400; ft += 200) {
      const z = -feetToMeters(ft)

      if (ft === 1000) {
        // Special 1000 ft crossbar - 70 ft wide total
        this.create1000FootCrossbar(z)
      } else {
        // Standard centerline bar - 5 lights with 40.5 inch spacing
        const barSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters
        for (let i = -2; i <= 2; i++) {
          const x = i * barSpacing
          const light = this.createLight(
            `ssalr_bar_${ft}_${i}`,
            new BABYLON.Vector3(x, 2, z),
            this.whiteMat!,
            0.6,
          )
          this.approachLights.push(light)
        }
      }
    }
  }

  private create1000FootCrossbar(z: number): void {
    // Center bar (5 lights with 40.5 inch spacing)
    const centerSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters
    for (let i = -2; i <= 2; i++) {
      const x = i * centerSpacing
      const light = this.createLight(
        `ssalr_1000_center_${i}`,
        new BABYLON.Vector3(x, 2, z),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }

    // Side bars - one on each side, 5 lights each with 5 ft spacing
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        // Position to create 70 ft total crossbar width
        const x = side * (feetToMeters(15) + i * feetToMeters(5))
        const light = this.createLight(
          `ssalr_1000_side_${side}_${i}`,
          new BABYLON.Vector3(x, 2, z),
          this.whiteMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  private createSSALRThresholdBar(): void {
    const thresholdSpacing = feetToMeters(10) // 10 ft centers
    const numThresholdLights = Math.floor(this.runwayWidthM / thresholdSpacing)

    for (let i = 0; i <= numThresholdLights; i++) {
      const x = -this.runwayWidthM / 2 + i * thresholdSpacing
      const light = this.createLight(
        `ssalr_threshold_${i}`,
        new BABYLON.Vector3(x, 1, 0),
        this.greenMat!,
        0.8,
      )
      this.approachLights.push(light)
    }
  }

  private createRAILFlashers(): void {
    // RAIL sequenced flashers - 5 flashers from 1600 to 2400 ft
    // First flasher is 200 ft beyond last steady light (1400 ft), so starts at 1600 ft
    for (let ft = 1600; ft <= 2400; ft += 200) {
      const z = -feetToMeters(ft)
      this.createSequencedFlasher(`ssalr_seq_${ft}`, new BABYLON.Vector3(0, 3, z))
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      hasSequencedFlashers: true,
      hasThresholdBar: true,
      hasREIL: true,
      systemLength: 2400,
    }
  }
}
