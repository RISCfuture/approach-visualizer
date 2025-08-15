import * as BABYLON from 'babylonjs'
import type { LightingType } from '@/types/approach'
import { ApproachLightingSystem } from './ApproachLightingSystem'
import { ALSFIISystem } from './systems/ALSFIISystem'
import { ALSFISystem } from './systems/ALSFISystem'
import { MALSSystem, MALSFSystem, MALSRSystem } from './systems/MALSSystem'
import { SSALRSystem } from './systems/SSALRSystem'
import { ODALSSystem } from './systems/ODALSSystem'

export class ApproachLightingFactory {
  /**
   * Creates the appropriate approach lighting system based on the type
   */
  static create(
    type: LightingType,
    scene: BABYLON.Scene,
    glowLayer: BABYLON.GlowLayer | null,
    options?: {
      showPAPI?: boolean
    },
  ): ApproachLightingSystem | null {
    switch (type) {
      case 'ALSF-II':
        return new ALSFIISystem(scene, glowLayer)

      case 'ALSF-I':
        return new ALSFISystem(scene, glowLayer)

      case 'MALS':
        return new MALSSystem(scene, glowLayer)

      case 'MALSF':
        return new MALSFSystem(scene, glowLayer)

      case 'MALSR':
        return new MALSRSystem(scene, glowLayer)

      case 'SSALR':
        return new SSALRSystem(scene, glowLayer)

      case 'ODALS':
        return new ODALSSystem(scene, glowLayer, options?.showPAPI || false)

      case 'None':
        return null

      default:
        console.warn(`Unknown lighting type: ${type}`)
        return null
    }
  }

  /**
   * Gets configuration for a lighting type without creating the system
   */
  static getConfig(type: LightingType): {
    hasSequencedFlashers: boolean
    hasThresholdBar: boolean
    hasREIL: boolean
    systemLength: number
  } | null {
    switch (type) {
      case 'ALSF-II':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 2400,
        }

      case 'ALSF-I':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 3000,
        }

      case 'MALS':
        return {
          hasSequencedFlashers: false,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 1400,
        }

      case 'MALSF':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 1400,
        }

      case 'MALSR':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 2400,
        }

      case 'SSALR':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: true,
          hasREIL: true,
          systemLength: 2400,
        }

      case 'ODALS':
        return {
          hasSequencedFlashers: true,
          hasThresholdBar: false,
          hasREIL: false,
          systemLength: 1500,
        }

      case 'None':
        return {
          hasSequencedFlashers: false,
          hasThresholdBar: false,
          hasREIL: false,
          systemLength: 0,
        }

      default:
        return null
    }
  }
}
