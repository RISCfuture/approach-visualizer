import * as BABYLON from 'babylonjs'
import { ApproachLightingSystem, type LightingSystemConfig } from '../ApproachLightingSystem'
import { feetToMeters } from '@/types/approach'

/**
 * ALSF-I: Approach Lighting System with Sequenced Flashing Lights
 * 3000 ft system for CAT I runways
 */
export class ALSFISystem extends ApproachLightingSystem {
  create(): void {
    // 1. Centerline barrettes - every 100 ft from station 1+00 to 30+00
    this.createCenterlineBarrettes()

    // 2. Pre-threshold bar at station 1+00 (100 ft) - RED
    this.createPreThresholdBar()

    // 3. Terminating bar at station 2+00 (200 ft) - RED
    this.createTerminatingBar()

    // 4. Green threshold bar
    this.createThresholdBar()

    // 5. Sequenced flashers - 21 lights from station 10+00 to 30+00
    this.createSequencedFlashers()
  }

  private createCenterlineBarrettes(): void {
    // Each barrette: 5 lights at 40.5 inch (1.03m) spacing
    const barrSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters

    for (let ft = 100; ft <= 3000; ft += 100) {
      const z = -feetToMeters(ft)

      if (ft === 1000) {
        // Station 10+00: Special 1000 ft crossbar with centerline barrette
        this.create1000FootCrossbar(z, barrSpacing)
      } else {
        // Standard centerline barrette - 5 lights at 40.5 inch spacing
        for (let i = -2; i <= 2; i++) {
          const x = i * barrSpacing
          const light = this.createLight(
            `alsf1_bar_${ft}_${i}`,
            new BABYLON.Vector3(x, 2, z),
            this.whiteMat!,
            0.6,
          )
          this.approachLights.push(light)
        }
      }
    }
  }

  private create1000FootCrossbar(z: number, barrSpacing: number): void {
    // Center barrette (5 lights)
    for (let i = -2; i <= 2; i++) {
      const x = i * barrSpacing
      const light = this.createLight(
        `alsf1_1000_center_${i}`,
        new BABYLON.Vector3(x, 2, z),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }

    // Side barrettes - 8 lights each at 5 ft spacing, outermost at 50 ft
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const x = side * (feetToMeters(22.5) + i * feetToMeters(5))
        const light = this.createLight(
          `alsf1_1000_side_${side}_${i}`,
          new BABYLON.Vector3(x, 2, z),
          this.whiteMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  private createPreThresholdBar(): void {
    // Pre-threshold bar at station 1+00 (100 ft) - RED
    // Two barrettes, 5 lights each at 3.5 ft centers
    // Innermost lights 75-80 ft from centerline
    const preThresholdZ = -feetToMeters(100)

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const x = side * (feetToMeters(75) + i * feetToMeters(3.5))
        const light = this.createLight(
          `alsf1_prethresh_${side}_${i}`,
          new BABYLON.Vector3(x, 2, preThresholdZ),
          this.redMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  private createTerminatingBar(): void {
    // Terminating bar at station 2+00 (200 ft) - RED
    // Two barrettes, 3 lights each at 5 ft centers
    // Outermost lights 25 ft from centerline
    const termZ = -feetToMeters(200)

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const x = side * (feetToMeters(15) + i * feetToMeters(5))
        const light = this.createLight(
          `alsf1_term_${side}_${i}`,
          new BABYLON.Vector3(x, 2, termZ),
          this.redMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  private createSequencedFlashers(): void {
    // Sequenced flashers - 21 lights from station 10+00 to 30+00
    for (let ft = 1000; ft <= 3000; ft += 100) {
      const z = -feetToMeters(ft)
      this.createSequencedFlasher(`alsf1_seq_${ft}`, new BABYLON.Vector3(0, 3, z))
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      hasSequencedFlashers: true,
      hasThresholdBar: true,
      hasREIL: true,
      systemLength: 3000,
    }
  }
}
