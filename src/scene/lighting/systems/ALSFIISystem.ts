import * as BABYLON from 'babylonjs'
import { ApproachLightingSystem, type LightingSystemConfig } from '../ApproachLightingSystem'
import { feetToMeters } from '@/types/approach'

/**
 * ALSF-II: Approach Lighting System with Sequenced Flashing Lights
 * FAA specification for CAT II/III runways
 * Extends 2400 ft from threshold with multiple light bars and configurations
 */
export class ALSFIISystem extends ApproachLightingSystem {
  private runwayLights: BABYLON.Mesh[] = [] // For touchdown zone lights

  create(): void {
    // 1. Centerline light bars every 100 ft from 100 to 2400 ft
    this.createCenterlineBars()

    // 2. 500-foot bar - white lights extending 30 ft on each side
    this.create500FootBar()

    // 3. Red side row bars - 3 red lights on each side for stations 100-900 ft
    this.createRedSideBars()

    // 4. Green threshold bar
    this.createThresholdBar()

    // 5. Touchdown zone lights (white barrettes)
    this.createTouchdownZoneLights()

    // 6. Sequenced flashers from 1000 ft to 2400 ft
    this.createSequencedFlashers()
  }

  private createCenterlineBars(): void {
    // Each standard bar is 14 ft long with 5 equally spaced lights
    for (let ft = 100; ft <= 2400; ft += 100) {
      const z = -feetToMeters(ft)

      if (ft === 1000) {
        // 1000-foot bar - special 100 ft wide bar (21 lights with closer spacing)
        this.create1000FootBar(z)
      } else {
        // Standard 14 ft centerline bar with 5 lights
        for (let i = -2; i <= 2; i++) {
          const x = i * feetToMeters(3.5) // 14 ft / 4 spaces = 3.5 ft
          const light = this.createLight(
            `alsf2_bar_${ft}_${i}`,
            new BABYLON.Vector3(x, 2, z),
            this.whiteMat!,
            0.6,
          )
          this.approachLights.push(light)
        }
      }
    }
  }

  private create1000FootBar(z: number): void {
    // Main centerline bar (5 lights)
    for (let i = -2; i <= 2; i++) {
      const x = i * feetToMeters(3) // 3 ft spacing
      const light = this.createLight(
        `alsf2_1000_center_${i}`,
        new BABYLON.Vector3(x, 2, z),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }

    // Extended portions (8 lights on each side)
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= 8; i++) {
        const x = side * (feetToMeters(15) + i * feetToMeters(5))
        const light = this.createLight(
          `alsf2_1000_ext_${side}_${i}`,
          new BABYLON.Vector3(x, 2, z),
          this.whiteMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  private create500FootBar(): void {
    const fiveHundredZ = -feetToMeters(500)

    // Left side barrette
    for (let i = 0; i < 4; i++) {
      const x = -feetToMeters(15 + i * 5) // Starting 15 ft from center
      const light = this.createLight(
        `alsf2_500bar_left_${i}`,
        new BABYLON.Vector3(x, 2, fiveHundredZ),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }

    // Right side barrette
    for (let i = 0; i < 4; i++) {
      const x = feetToMeters(15 + i * 5) // Starting 15 ft from center
      const light = this.createLight(
        `alsf2_500bar_right_${i}`,
        new BABYLON.Vector3(x, 2, fiveHundredZ),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }
  }

  private createRedSideBars(): void {
    // Red side row bars - 3 red lights on each side for stations 100-900 ft
    // Aligned with touchdown zone lights position
    for (let ft = 100; ft <= 900; ft += 100) {
      const z = -feetToMeters(ft)
      for (let side = -1; side <= 1; side += 2) {
        // 3 lights starting from about 40 ft from centerline
        for (let i = 0; i < 3; i++) {
          const x = side * feetToMeters(40 + i * 5) // 40, 45, 50 ft from centerline
          const light = this.createLight(
            `alsf2_sidebar_${ft}_${side}_${i}`,
            new BABYLON.Vector3(x, 2, z),
            this.redMat!,
            0.5,
          )
          this.approachLights.push(light)
        }
      }
    }
  }

  private createTouchdownZoneLights(): void {
    // Touchdown zone lights (white barrettes) - similar geometry to red side bars
    // Located at 100 ft intervals from 100-1000 ft on runway
    const tdzStations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    for (const ft of tdzStations) {
      const z = feetToMeters(ft) // Positive z for runway surface
      for (let side = -1; side <= 1; side += 2) {
        // Create a barrette of 3 lights like the red side bars
        for (let i = 0; i < 3; i++) {
          const light = this.createLight(
            `alsf2_tdz_${ft}_${side}_${i}`,
            new BABYLON.Vector3(
              side * feetToMeters(40 + i * 5), // 40, 45, 50 ft from centerline
              1,
              z,
            ),
            this.whiteMat!,
            0.6,
          )
          this.runwayLights.push(light) // These are runway lights, not approach lights
        }
      }
    }
  }

  private createSequencedFlashers(): void {
    // Sequenced flashers - from 1000 ft to end of system (2400 ft)
    // One at each centerline bar position, flashing toward threshold at 2 Hz
    for (let ft = 1000; ft <= 2400; ft += 100) {
      const z = -feetToMeters(ft)
      this.createSequencedFlasher(`alsf2_seq_${ft}`, new BABYLON.Vector3(0, 3, z))
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

  getRunwayLights(): BABYLON.Mesh[] {
    return this.runwayLights
  }

  dispose(): void {
    super.dispose()
    this.runwayLights.forEach((light) => light.dispose())
    this.runwayLights = []
  }
}
