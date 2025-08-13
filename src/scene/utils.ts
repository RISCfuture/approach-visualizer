import * as BABYLON from 'babylonjs'
import { feetToMeters, RUNWAY_LENGTH_FT, TOUCHDOWN_ZONE_DISTANCE_FT } from '@/types/approach'

// Camera utilities
export function calculateCameraPosition(
  currentAltitude: number,
  currentDistanceNm: number,
): BABYLON.Vector3 {
  const altitudeMeters = feetToMeters(currentAltitude)
  const distanceMeters = currentDistanceNm * 1852 // NM to meters

  // Position camera based on current approach position
  // Camera is positioned at the aircraft location
  const runwayLength = feetToMeters(RUNWAY_LENGTH_FT)
  const tdZoneDistance = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)

  // Place camera at correct position along approach path
  // Z position: threshold is at runwayLength/2, touchdown zone is 1000ft before that
  const zPosition = runwayLength / 2 - tdZoneDistance + distanceMeters

  return new BABYLON.Vector3(0, altitudeMeters, zPosition)
}

export function calculateGlideslope(altitude: number, distanceNm: number): number {
  const distanceFt = distanceNm * 6076
  const angleRadians = Math.atan(altitude / distanceFt)
  return (angleRadians * 180) / Math.PI
}

// Runway marking utilities
export function createRunwayMarkingMaterial(
  name: string,
  scene: BABYLON.Scene,
  isDarkMode: boolean,
): BABYLON.StandardMaterial {
  const mat = new BABYLON.StandardMaterial(name, scene)
  mat.diffuseColor = new BABYLON.Color3(1, 1, 1)
  mat.emissiveColor = isDarkMode ? new BABYLON.Color3(0.9, 0.9, 0.9) : new BABYLON.Color3(0, 0, 0)
  mat.specularColor = new BABYLON.Color3(0, 0, 0)
  return mat
}

export function createGroundMaterial(
  scene: BABYLON.Scene,
  isDarkMode: boolean,
): BABYLON.StandardMaterial {
  const groundMat = new BABYLON.StandardMaterial('ground', scene)
  if (isDarkMode) {
    groundMat.diffuseColor = new BABYLON.Color3(0.02, 0.03, 0.02) // Very dark green
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
    groundMat.emissiveColor = new BABYLON.Color3(0.01, 0.015, 0.01) // Slight self-illumination
  } else {
    groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.35, 0.15)
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
  }
  return groundMat
}

export function createRunwayMaterial(
  scene: BABYLON.Scene,
  isDarkMode: boolean,
): BABYLON.StandardMaterial {
  const runwayMat = new BABYLON.StandardMaterial('runway', scene)
  if (isDarkMode) {
    runwayMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.08) // Dark gray
    runwayMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02) // Slight visibility
    runwayMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05) // Minimal specularity
  } else {
    runwayMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15)
    runwayMat.specularColor = new BABYLON.Color3(0, 0, 0)
  }
  return runwayMat
}

// Animation utilities
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

// Distance calculations
export function calculateSlantDistance(altitude: number, horizontalDistance: number): number {
  return Math.sqrt(altitude * altitude + horizontalDistance * horizontalDistance)
}

export function calculateTouchdownZoneDistance(): number {
  // Distance from threshold to touchdown zone aiming point
  return feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)
}

// Visibility helpers
export function isWithinVisibilityRange(
  currentDistanceNm: number,
  visibility: number,
  visibilityUnit: 'RVR' | 'SM',
): boolean {
  let visibilityNm: number
  if (visibilityUnit === 'SM') {
    // Convert statute miles to nautical miles
    visibilityNm = visibility * 0.869
  } else {
    // Convert RVR (feet) to nautical miles
    const visibilitySM = visibility / 5280
    visibilityNm = visibilitySM * 0.869
  }
  return currentDistanceNm <= visibilityNm
}

// Scene helpers
export function updateSceneColors(scene: BABYLON.Scene, isDarkMode: boolean): void {
  if (isDarkMode) {
    // Night sky - deep blue with hint of moonlight
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1)
    scene.fogColor = new BABYLON.Color3(0.06, 0.06, 0.14)
  } else {
    // Day sky
    scene.clearColor = new BABYLON.Color4(0.6, 0.75, 0.9, 1)
    scene.fogColor = new BABYLON.Color3(0.7, 0.75, 0.8)
  }
}
