import * as BABYLON from 'babylonjs'
import type { LightingType } from '@/types/approach'
import { ApproachLightingSystem } from './ApproachLightingSystem'
import { ALSFIISystem } from './systems/ALSFIISystem'
import { ALSFISystem } from './systems/ALSFISystem'
import { MALSSystem, MALSFSystem, MALSRSystem } from './systems/MALSSystem'
import { SSALRSystem } from './systems/SSALRSystem'
import { ODALSSystem } from './systems/ODALSSystem'

/**
 * Creates the appropriate approach lighting system based on the type
 */
export function createApproachLighting(
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
      return new ODALSSystem(scene, glowLayer, options?.showPAPI ?? false)

    case 'None':
      return null

    default:
      console.warn(`Unknown lighting type: ${String(type)}`)
      return null
  }
}
