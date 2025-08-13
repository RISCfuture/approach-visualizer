import * as BABYLON from 'babylonjs'
import {
  feetToMeters,
  RUNWAY_LENGTH_FT,
  RUNWAY_WIDTH_FT,
  TOUCHDOWN_ZONE_DISTANCE_FT,
} from '@/types/approach'
import { createRunwayMaterial, createRunwayMarkingMaterial, createGroundMaterial } from '../utils'

export class RunwayManager {
  private scene: BABYLON.Scene
  private runway: BABYLON.Mesh | null = null
  private ground: BABYLON.Mesh | null = null
  private markings: BABYLON.Mesh[] = []

  constructor(scene: BABYLON.Scene) {
    this.scene = scene
  }

  createRunway(isDarkMode: boolean): void {
    const runwayLength = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidth = feetToMeters(RUNWAY_WIDTH_FT)

    // Create runway surface
    this.runway = BABYLON.MeshBuilder.CreateBox(
      'runway',
      { width: runwayWidth, height: 0.1, depth: runwayLength },
      this.scene,
    )
    this.runway.position.y = -0.05
    this.runway.material = createRunwayMaterial(this.scene, isDarkMode)

    // Create runway markings
    this.createRunwayMarkings(runwayLength, runwayWidth, isDarkMode)
  }

  createGround(isDarkMode: boolean): void {
    // Create ground plane
    this.ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: 10000, height: 10000 },
      this.scene,
    )
    this.ground.position.y = -0.1
    this.ground.material = createGroundMaterial(this.scene, isDarkMode)
  }

  private createRunwayMarkings(length: number, width: number, isDarkMode: boolean): void {
    // Clear existing markings
    this.markings.forEach((marking) => marking.dispose())
    this.markings = []

    const markingMat = createRunwayMarkingMaterial('marking', this.scene, isDarkMode)

    // Centerline stripes
    const stripeLength = 30 // meters
    const stripeWidth = 0.9 // meters
    const stripeGap = 20 // meters
    const totalStripeSpacing = stripeLength + stripeGap
    const numStripes = Math.floor(length / totalStripeSpacing)

    for (let i = 0; i < numStripes; i++) {
      const stripe = BABYLON.MeshBuilder.CreateBox(
        'centerStripe',
        { width: stripeWidth, height: 0.01, depth: stripeLength },
        this.scene,
      )
      stripe.position.y = 0.05
      stripe.position.z = -length / 2 + stripeLength / 2 + i * totalStripeSpacing
      stripe.material = markingMat
      this.markings.push(stripe)
    }

    // Threshold markings
    const thresholdStripeWidth = 1.8
    const thresholdStripeLength = 45
    const thresholdSpacing = 1.8
    const numThresholdStripes = 8

    for (let i = 0; i < numThresholdStripes; i++) {
      const xOffset =
        -((numThresholdStripes - 1) * (thresholdStripeWidth + thresholdSpacing)) / 2 +
        i * (thresholdStripeWidth + thresholdSpacing)

      const stripe = BABYLON.MeshBuilder.CreateBox(
        'thresholdStripe',
        { width: thresholdStripeWidth, height: 0.01, depth: thresholdStripeLength },
        this.scene,
      )
      stripe.position.x = xOffset
      stripe.position.y = 0.05
      stripe.position.z = length / 2 - thresholdStripeLength / 2 - 5 // 5m from runway end
      stripe.material = markingMat
      this.markings.push(stripe)
    }

    // Touchdown zone markings
    const tdZoneDistance = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)
    const tdZoneFromThreshold = tdZoneDistance
    const tdMarkingWidth = 1.8
    const tdMarkingLength = 22.5
    const tdSpacing = 1.5

    // Create sets of touchdown zone markings
    for (let set = 0; set < 3; set++) {
      const zOffset = length / 2 - tdZoneFromThreshold - set * 150 // 150m between sets

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
          const xOffset = side * (5 + i * (tdMarkingWidth + tdSpacing))

          const marking = BABYLON.MeshBuilder.CreateBox(
            'tdMarking',
            { width: tdMarkingWidth, height: 0.01, depth: tdMarkingLength },
            this.scene,
          )
          marking.position.x = xOffset
          marking.position.y = 0.05
          marking.position.z = zOffset
          marking.material = markingMat
          this.markings.push(marking)
        }
      }
    }

    // Aiming point markings (the big rectangles)
    const aimingPointLength = 45
    const aimingPointWidth = 3
    const aimingPointOffset = 9

    for (let side = -1; side <= 1; side += 2) {
      const aimingPoint = BABYLON.MeshBuilder.CreateBox(
        'aimingPoint',
        { width: aimingPointWidth, height: 0.01, depth: aimingPointLength },
        this.scene,
      )
      aimingPoint.position.x = side * aimingPointOffset
      aimingPoint.position.y = 0.05
      aimingPoint.position.z = length / 2 - tdZoneFromThreshold
      aimingPoint.material = markingMat
      this.markings.push(aimingPoint)
    }

    // Runway numbers
    this.createRunwayNumbers(length, isDarkMode)
  }

  private createRunwayNumbers(runwayLength: number, isDarkMode: boolean): void {
    // Create runway numbers as simple boxes (simplified for now)
    const numberMat = createRunwayMarkingMaterial('number', this.scene, isDarkMode)

    // "09" at approach end
    const nine = BABYLON.MeshBuilder.CreateBox(
      'nine',
      { width: 3, height: 0.01, depth: 4.5 },
      this.scene,
    )
    nine.position.x = -3
    nine.position.y = 0.05
    nine.position.z = runwayLength / 2 - 60
    nine.material = numberMat
    this.markings.push(nine)

    const zero = BABYLON.MeshBuilder.CreateBox(
      'zero',
      { width: 3, height: 0.01, depth: 4.5 },
      this.scene,
    )
    zero.position.x = 3
    zero.position.y = 0.05
    zero.position.z = runwayLength / 2 - 60
    zero.material = numberMat
    this.markings.push(zero)

    // "27" at far end
    const two = BABYLON.MeshBuilder.CreateBox(
      'two',
      { width: 3, height: 0.01, depth: 4.5 },
      this.scene,
    )
    two.position.x = -3
    two.position.y = 0.05
    two.position.z = -runwayLength / 2 + 60
    two.material = numberMat
    this.markings.push(two)

    const seven = BABYLON.MeshBuilder.CreateBox(
      'seven',
      { width: 3, height: 0.01, depth: 4.5 },
      this.scene,
    )
    seven.position.x = 3
    seven.position.y = 0.05
    seven.position.z = -runwayLength / 2 + 60
    seven.material = numberMat
    this.markings.push(seven)
  }

  updateForDarkMode(isDarkMode: boolean): void {
    if (this.runway) {
      this.runway.material = createRunwayMaterial(this.scene, isDarkMode)
    }
    if (this.ground) {
      this.ground.material = createGroundMaterial(this.scene, isDarkMode)
    }
    // Recreate markings with updated materials
    const runwayLength = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidth = feetToMeters(RUNWAY_WIDTH_FT)
    this.createRunwayMarkings(runwayLength, runwayWidth, isDarkMode)
  }

  dispose(): void {
    if (this.runway) {
      this.runway.dispose()
      this.runway = null
    }
    if (this.ground) {
      this.ground.dispose()
      this.ground = null
    }
    this.markings.forEach((marking) => marking.dispose())
    this.markings = []
  }
}
