import * as BABYLON from 'babylonjs'
import { ApproachLightingSystem, type LightingSystemConfig } from '../ApproachLightingSystem'
import { feetToMeters } from '@/types/approach'

/**
 * MALS: Medium-intensity Approach Lighting System (base configuration)
 * Base class for MALS, MALSF, and MALSR systems
 */
export class MALSSystem extends ApproachLightingSystem {
  protected prefix: string = 'mals'

  create(): void {
    this.createMALSBase()
  }

  protected createMALSBase(): void {
    // 1. Seven five-light centerline bars from 200 to 1400 ft at 200 ft intervals
    const barSpacing = feetToMeters(2.5) // 2.5 ft spacing between lights

    for (let ft = 200; ft <= 1400; ft += 200) {
      const z = -feetToMeters(ft)

      if (ft === 1000) {
        // Special 1000 ft crossbar - 66 ft wide total
        this.create1000FootCrossbar(z, barSpacing)
      } else {
        // Standard centerline bar - 5 lights with 2.5 ft spacing
        for (let i = -2; i <= 2; i++) {
          const x = i * barSpacing
          const light = this.createLight(
            `${this.prefix}_bar_${ft}_${i}`,
            new BABYLON.Vector3(x, 2, z),
            this.whiteMat!,
            0.6,
          )
          this.approachLights.push(light)
        }
      }
    }

    // 2. Green threshold bar - lights on 10 ft centers across runway
    this.createMALSThresholdBar()
  }

  private create1000FootCrossbar(z: number, barSpacing: number): void {
    // Center bar (5 lights)
    for (let i = -2; i <= 2; i++) {
      const x = i * barSpacing
      const light = this.createLight(
        `${this.prefix}_1000_center_${i}`,
        new BABYLON.Vector3(x, 2, z),
        this.whiteMat!,
        0.6,
      )
      this.approachLights.push(light)
    }

    // Side bars - one on each side (5 lights each, 2.5 ft spacing)
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        // Position to create 66 ft total crossbar width
        const x = side * (feetToMeters(13) + i * barSpacing)
        const light = this.createLight(
          `${this.prefix}_1000_side_${side}_${i}`,
          new BABYLON.Vector3(x, 2, z),
          this.whiteMat!,
          0.6,
        )
        this.approachLights.push(light)
      }
    }
  }

  protected createMALSThresholdBar(): void {
    const thresholdSpacing = feetToMeters(10) // 10 ft centers
    const numThresholdLights = Math.floor(this.runwayWidthM / thresholdSpacing)

    for (let i = 0; i <= numThresholdLights; i++) {
      const x = -this.runwayWidthM / 2 + i * thresholdSpacing
      const light = this.createLight(
        `${this.prefix}_threshold_${i}`,
        new BABYLON.Vector3(x, 1, 0),
        this.greenMat!,
        0.8,
      )
      this.approachLights.push(light)
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      hasSequencedFlashers: false,
      hasThresholdBar: true,
      hasREIL: true,
      systemLength: 1400,
    }
  }
}

/**
 * MALSF: MALS with three sequenced flashers at last three stations
 */
export class MALSFSystem extends MALSSystem {
  protected prefix = 'malsf'

  create(): void {
    super.create()

    // Add three sequenced flashers at last three stations (1000, 1200, 1400 ft)
    const flasherPositions = [1000, 1200, 1400]
    for (const ft of flasherPositions) {
      const z = -feetToMeters(ft)
      this.createSequencedFlasher(`malsf_seq_${ft}`, new BABYLON.Vector3(0, 3, z))
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      ...super.getConfig(),
      hasSequencedFlashers: true,
    }
  }
}

/**
 * MALSR: MALS plus RAIL (Runway Alignment Indicator Lights)
 * For CAT I runways
 */
export class MALSRSystem extends MALSSystem {
  protected prefix = 'malsr'

  create(): void {
    super.create()

    // RAIL sequenced flashers - 5 flashers from 1600 to 2400 ft
    // First flasher is 200 ft beyond MALS end (1400 ft)
    for (let ft = 1600; ft <= 2400; ft += 200) {
      const z = -feetToMeters(ft)
      this.createSequencedFlasher(`malsr_seq_${ft}`, new BABYLON.Vector3(0, 3, z))
    }
  }

  getConfig(): LightingSystemConfig {
    return {
      ...super.getConfig(),
      hasSequencedFlashers: true,
      systemLength: 2400, // Extended due to RAIL
    }
  }
}
