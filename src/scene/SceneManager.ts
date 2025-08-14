import * as BABYLON from 'babylonjs'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import {
  feetToMeters,
  statuteMilesToMeters,
  RUNWAY_LENGTH_FT,
  RUNWAY_WIDTH_FT,
  FEET_PER_NM,
  TOUCHDOWN_ZONE_DISTANCE_FT,
} from '@/types/approach'
import type { LightingType } from '@/types/approach'

export class SceneManager {
  private engine: BABYLON.Engine
  private scene: BABYLON.Scene
  private camera: BABYLON.UniversalCamera
  private canvas: HTMLCanvasElement
  private approachStore: ReturnType<typeof useApproachStore>
  private animationStore: ReturnType<typeof useAnimationStore>
  private approachLights: BABYLON.Mesh[] = []
  private runwayLights: BABYLON.Mesh[] = []
  private reilLights: BABYLON.Mesh[] = []
  private papiLights: BABYLON.Mesh[] = []
  private lastFrameTime: number = 0
  private fogPostProcess: BABYLON.PostProcess | null = null
  private cloudParticles: BABYLON.ParticleSystem | null = null
  private cloudTransitionTime: number = 0
  private lastAltitudeInClouds: boolean = false
  private reilFlashInterval: number | null = null
  private rabbitInterval: number | null = null
  private sequencedFlashers: BABYLON.Mesh[] = []
  private isDarkMode: boolean = false
  private glowLayer: BABYLON.GlowLayer | null = null
  private papiRedMat: BABYLON.StandardMaterial | null = null
  private papiWhiteMat: BABYLON.StandardMaterial | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.engine = new BABYLON.Engine(canvas, true)
    this.scene = new BABYLON.Scene(this.engine)
    this.approachStore = useApproachStore()
    this.animationStore = useAnimationStore()

    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, 0), this.scene)
    this.camera.attachControl(canvas, false)
    this.camera.inputs.clear()
    this.camera.fov = 0.8

    this.checkDarkMode() // Check dark mode BEFORE setting up scene
    this.setupScene()
    this.createRunway()
    this.createGround()
    this.updateLighting()
    this.setupWeatherEffects()
    this.resetCameraPosition()

    // Listen for dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.isDarkMode = e.matches
      this.updateSceneForDarkMode()
    })

    this.engine.runRenderLoop(() => {
      this.update()
      this.scene.render()
    })

    window.addEventListener('resize', () => {
      this.engine.resize()
    })
  }

  private setupScene(): void {
    // Clear existing lights if any
    this.scene.lights.forEach((light) => light.dispose())

    if (this.isDarkMode) {
      // Night sky - deep blue with hint of moonlight
      this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1) // Deep night blue
      this.scene.fogColor = new BABYLON.Color3(0.06, 0.06, 0.14) // Slightly lighter for fog
    } else {
      // Day sky
      this.scene.clearColor = new BABYLON.Color4(0.6, 0.75, 0.9, 1)
      this.scene.fogColor = new BABYLON.Color3(0.7, 0.75, 0.8)
    }

    // Basic fog for depth
    this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR
    this.updateFogDistance()

    // Ambient lighting - moonlight effect at night
    const ambientLight = new BABYLON.HemisphericLight(
      'ambient',
      new BABYLON.Vector3(0, 1, 0),
      this.scene,
    )
    ambientLight.intensity = this.isDarkMode ? 0.08 : 0.6 // Subtle moonlight
    ambientLight.groundColor = this.isDarkMode
      ? new BABYLON.Color3(0.02, 0.02, 0.04) // Very dark ground reflection
      : new BABYLON.Color3(0.3, 0.3, 0.35)

    // Sun/Moon light
    const directionalLight = new BABYLON.DirectionalLight(
      'sun',
      new BABYLON.Vector3(-0.3, -0.7, 0.5),
      this.scene,
    )
    directionalLight.intensity = this.isDarkMode ? 0.05 : 0.5 // Moonlight glow
  }

  private createRunway(): void {
    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    // Main runway surface
    const runway = BABYLON.MeshBuilder.CreateBox(
      'runway',
      {
        width: runwayWidthM,
        height: 0.3,
        depth: runwayLengthM,
      },
      this.scene,
    )
    runway.position.y = 0 // Ground level
    runway.position.z = runwayLengthM / 2 // Center the runway ahead

    const runwayMat = new BABYLON.StandardMaterial('runwayMat', this.scene)
    runwayMat.diffuseColor = this.isDarkMode
      ? new BABYLON.Color3(0.15, 0.15, 0.17) // Dark asphalt with slight blue tint at night
      : new BABYLON.Color3(0.3, 0.3, 0.3) // Gray asphalt during day
    runwayMat.specularColor = this.isDarkMode
      ? new BABYLON.Color3(0.02, 0.02, 0.03) // Minimal reflection at night
      : new BABYLON.Color3(0.1, 0.1, 0.1)
    runway.material = runwayMat

    this.createRunwayMarkings(runwayLengthM, runwayWidthM)
  }

  private createGround(): void {
    // Create ground
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      {
        width: 10000,
        height: 20000,
      },
      this.scene,
    )
    ground.position.y = -1 // Lower than runway
    ground.position.z = 0

    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene)
    groundMat.diffuseColor = this.isDarkMode
      ? new BABYLON.Color3(0.03, 0.04, 0.03) // Dark grass with subtle green under moonlight
      : new BABYLON.Color3(0.1, 0.2, 0.1) // Green grass during day
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
    if (this.isDarkMode) {
      groundMat.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.01) // Very subtle self-illumination for moonlight
    }
    ground.material = groundMat
  }

  private createRunwayMarkings(length: number, width: number): void {
    const markingMat = new BABYLON.StandardMaterial('markingMat', this.scene)
    markingMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
    // Reduce brightness at night to simulate moonlight on semi-reflective paint
    markingMat.emissiveColor = this.isDarkMode
      ? new BABYLON.Color3(0.15, 0.15, 0.15) // Dim moonlight reflection
      : new BABYLON.Color3(0.8, 0.8, 0.8) // Brighter for day visibility

    // FAA standard dimensions in feet
    const centerlineStripeLengthFt = 120
    const centerlineGapFt = 80
    const centerlineWidthFt = 3
    const aimingPointLengthFt = 150
    const aimingPointWidthFt = 20

    // Convert to meters
    const centerlineStripeLength = feetToMeters(centerlineStripeLengthFt)
    const centerlineGap = feetToMeters(centerlineGapFt)
    const centerlineWidth = feetToMeters(centerlineWidthFt)
    const aimingPointLength = feetToMeters(aimingPointLengthFt)
    const aimingPointWidth = feetToMeters(aimingPointWidthFt)

    // Threshold markings - 8 stripes for runways 150+ ft wide
    const numThresholdStripes = 12
    const thresholdStripeWidth = feetToMeters(5.75)
    const thresholdStripeLength = feetToMeters(150)
    const thresholdGap =
      (width - numThresholdStripes * thresholdStripeWidth) / (numThresholdStripes + 1)

    for (let i = 0; i < numThresholdStripes; i++) {
      const stripe = BABYLON.MeshBuilder.CreateBox(
        `threshold${i}`,
        {
          width: thresholdStripeWidth,
          height: 0.05,
          depth: thresholdStripeLength,
        },
        this.scene,
      )
      const x =
        -width / 2 +
        thresholdGap +
        i * (thresholdStripeWidth + thresholdGap) +
        thresholdStripeWidth / 2
      stripe.position.z = feetToMeters(75)
      stripe.position.x = x
      stripe.position.y = 0.2 // Just above runway surface
      stripe.material = markingMat
    }

    // Runway designation numbers (09 from our approach, opposite of 27)
    const createNumber09 = () => {
      // We're approaching runway 09 (opposite end of 27)
      // Numbers are 60 ft tall
      const numberHeight = feetToMeters(60)
      const numberWidth = feetToMeters(20)
      const strokeWidth = feetToMeters(5)
      const baseZ = feetToMeters(200) // Starting position

      // "0" (on left when approaching)
      const zero1 = BABYLON.MeshBuilder.CreateBox(
        'zero1',
        {
          width: numberWidth,
          height: 0.05,
          depth: strokeWidth,
        },
        this.scene,
      )
      zero1.position.set(-feetToMeters(30), 0.2, baseZ)
      zero1.material = markingMat

      const zero2 = BABYLON.MeshBuilder.CreateBox(
        'zero2',
        {
          width: strokeWidth,
          height: 0.05,
          depth: numberHeight - strokeWidth,
        },
        this.scene,
      )
      zero2.position.set(
        -feetToMeters(30) - numberWidth / 2 + strokeWidth / 2,
        0.2,
        baseZ + numberHeight / 2,
      )
      zero2.material = markingMat

      const zero3 = BABYLON.MeshBuilder.CreateBox(
        'zero3',
        {
          width: strokeWidth,
          height: 0.05,
          depth: numberHeight - strokeWidth,
        },
        this.scene,
      )
      zero3.position.set(
        -feetToMeters(30) + numberWidth / 2 - strokeWidth / 2,
        0.2,
        baseZ + numberHeight / 2,
      )
      zero3.material = markingMat

      const zero4 = BABYLON.MeshBuilder.CreateBox(
        'zero4',
        {
          width: numberWidth,
          height: 0.05,
          depth: strokeWidth,
        },
        this.scene,
      )
      zero4.position.set(-feetToMeters(30), 0.2, baseZ + numberHeight - strokeWidth)
      zero4.material = markingMat

      // "9" (on right when approaching)
      const nine1 = BABYLON.MeshBuilder.CreateBox(
        'nine1',
        {
          width: numberWidth,
          height: 0.05,
          depth: strokeWidth,
        },
        this.scene,
      )
      nine1.position.set(feetToMeters(30), 0.2, baseZ)
      nine1.material = markingMat

      const nine2 = BABYLON.MeshBuilder.CreateBox(
        'nine2',
        {
          width: strokeWidth,
          height: 0.05,
          depth: numberHeight / 2,
        },
        this.scene,
      )
      nine2.position.set(
        feetToMeters(30) - numberWidth / 2 + strokeWidth / 2,
        0.2,
        baseZ + numberHeight / 4,
      )
      nine2.material = markingMat

      const nine3 = BABYLON.MeshBuilder.CreateBox(
        'nine3',
        {
          width: numberWidth,
          height: 0.05,
          depth: strokeWidth,
        },
        this.scene,
      )
      nine3.position.set(feetToMeters(30), 0.2, baseZ + numberHeight / 2)
      nine3.material = markingMat

      const nine4 = BABYLON.MeshBuilder.CreateBox(
        'nine4',
        {
          width: strokeWidth,
          height: 0.05,
          depth: numberHeight / 2,
        },
        this.scene,
      )
      nine4.position.set(
        feetToMeters(30) + numberWidth / 2 - strokeWidth / 2,
        0.2,
        baseZ + (3 * numberHeight) / 4,
      )
      nine4.material = markingMat

      const nine5 = BABYLON.MeshBuilder.CreateBox(
        'nine5',
        {
          width: numberWidth,
          height: 0.05,
          depth: strokeWidth,
        },
        this.scene,
      )
      nine5.position.set(feetToMeters(30), 0.2, baseZ + numberHeight - strokeWidth)
      nine5.material = markingMat
    }
    createNumber09()

    // Centerline markings (120 ft stripes, 80 ft gaps)
    const centerlineStart = feetToMeters(500) // Start after threshold area
    const centerlineInterval = centerlineStripeLength + centerlineGap
    const numCenterlines = Math.floor((length - centerlineStart) / centerlineInterval)

    for (let i = 0; i < numCenterlines; i++) {
      const centerline = BABYLON.MeshBuilder.CreateBox(
        `centerline${i}`,
        {
          width: centerlineWidth,
          height: 0.05,
          depth: centerlineStripeLength,
        },
        this.scene,
      )
      centerline.position.z = centerlineStart + i * centerlineInterval + centerlineStripeLength / 2
      centerline.position.y = 0.2
      centerline.material = markingMat
    }

    // Aiming point markings (1000 ft from threshold)
    const aimingPointZ = feetToMeters(1000)
    for (let side = -1; side <= 1; side += 2) {
      const aimingPoint = BABYLON.MeshBuilder.CreateBox(
        `aimingPoint_${side}`,
        {
          width: aimingPointWidth,
          height: 0.05,
          depth: aimingPointLength,
        },
        this.scene,
      )
      aimingPoint.position.z = aimingPointZ
      aimingPoint.position.x = side * feetToMeters(35) // 35 ft from centerline
      aimingPoint.position.y = 0.2
      aimingPoint.material = markingMat
    }

    // Touchdown zone markings (500 ft intervals)
    // Pattern: 3 bars at 500ft, 2 bars at 1000ft (covered by aiming point),
    // 1 bar at 1500ft, 2 bars at 2000ft, 3 bars at 2500ft
    const tdzPattern = [
      { distance: 500, bars: 3 },
      { distance: 1500, bars: 1 },
      { distance: 2000, bars: 2 },
      { distance: 2500, bars: 3 },
    ]

    for (const marker of tdzPattern) {
      for (let side = -1; side <= 1; side += 2) {
        for (let bar = 0; bar < marker.bars; bar++) {
          const tdz = BABYLON.MeshBuilder.CreateBox(
            `tdz_${marker.distance}_${side}_${bar}`,
            {
              width: feetToMeters(4),
              height: 0.05,
              depth: feetToMeters(75),
            },
            this.scene,
          )
          const barSpacing = feetToMeters(5)
          const groupWidth = marker.bars * feetToMeters(4) + (marker.bars - 1) * barSpacing
          const xOffset = -groupWidth / 2 + bar * (feetToMeters(4) + barSpacing) + feetToMeters(2)
          tdz.position.z = feetToMeters(marker.distance)
          tdz.position.x = side * feetToMeters(35) + xOffset
          tdz.position.y = 0.2
          tdz.material = markingMat
        }
      }
    }
  }

  private updateLighting(): void {
    this.clearLights()
    const lightingType = this.approachStore.lightingType
    this.createRunwayEdgeLights()
    this.createApproachLights(lightingType)
  }

  private clearLights(): void {
    this.approachLights.forEach((light) => light.dispose())
    this.runwayLights.forEach((light) => light.dispose())
    this.reilLights.forEach((light) => light.dispose())
    this.sequencedFlashers.forEach((light) => light.dispose())
    this.papiLights.forEach((light) => light.dispose())
    this.approachLights = []
    this.runwayLights = []
    this.reilLights = []
    this.sequencedFlashers = []
    this.papiLights = []

    // Clear flash intervals
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
      this.reilFlashInterval = null
    }
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
      this.rabbitInterval = null
    }
  }

  private createRunwayEdgeLights(): void {
    // Create or reuse glow layer for all lights
    if (!this.glowLayer) {
      this.glowLayer = new BABYLON.GlowLayer('glow', this.scene)
      this.glowLayer.intensity = this.isDarkMode ? 2.0 : 1.2
      this.glowLayer.blurKernelSize = 64
    }

    // Create PAPI lights
    this.createPAPILights()

    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    const lightSpacing = 60

    // Material definitions
    const whiteMat = new BABYLON.StandardMaterial('whiteLight', this.scene)
    whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    const yellowMat = new BABYLON.StandardMaterial('yellowLight', this.scene)
    yellowMat.emissiveColor = new BABYLON.Color3(1, 0.9, 0)
    yellowMat.diffuseColor = new BABYLON.Color3(1, 1, 0)

    const greenMat = new BABYLON.StandardMaterial('greenLight', this.scene)
    greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
    greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)

    const redMat = new BABYLON.StandardMaterial('redLight', this.scene)
    redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    // Calculate caution zone length (last 2000 ft or half runway, whichever is less)
    const cautionZoneLengthFt = Math.min(2000, RUNWAY_LENGTH_FT / 2)
    const cautionZoneStartM = runwayLengthM - feetToMeters(cautionZoneLengthFt)

    // Runway edge lights
    const numLights = Math.floor(runwayLengthM / lightSpacing)
    for (let i = 0; i <= numLights; i++) {
      const z = i * lightSpacing

      // Determine light color based on position
      let material = whiteMat
      if (z >= cautionZoneStartM) {
        // Yellow caution zone for last 2000 ft or half runway
        material = yellowMat
      }

      for (let side = -1; side <= 1; side += 2) {
        const light = BABYLON.MeshBuilder.CreateSphere(
          `runwayLight_${side}_${i}`,
          { diameter: 0.5, segments: 8 }, // Small point light
          this.scene,
        )
        light.position.x = side * (runwayWidthM / 2 + 3)
        light.position.z = z
        light.position.y = 1
        light.material = material
        if (this.glowLayer) {
          this.glowLayer.addIncludedOnlyMesh(light)
        }
        this.runwayLights.push(light)
      }
    }

    // Threshold lights (green outward for landing aircraft)
    for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
      const thresholdLight = BABYLON.MeshBuilder.CreateSphere(
        `threshold_green_${x}`,
        { diameter: 0.8, segments: 8 }, // Slightly larger for threshold
        this.scene,
      )
      thresholdLight.position.set(x, 1, 5)
      thresholdLight.material = greenMat
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(thresholdLight)
      }
      this.runwayLights.push(thresholdLight)
    }

    // Runway end lights (red toward runway for departing aircraft)
    // These are at the far end of the runway
    for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
      const endLight = BABYLON.MeshBuilder.CreateSphere(
        `runway_end_red_${x}`,
        { diameter: 0.8, segments: 8 }, // Same size as threshold lights
        this.scene,
      )
      endLight.position.set(x, 1, runwayLengthM - 5) // Near the end of runway
      endLight.material = redMat
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(endLight)
      }
      this.runwayLights.push(endLight)
    }

    // Add bi-directional lights at runway ends (red/green depending on direction)
    // At threshold (0 ft) - red inward (for opposite direction departures)
    for (let side = -1; side <= 1; side += 2) {
      const thresholdEndLight = BABYLON.MeshBuilder.CreateSphere(
        `threshold_end_${side}`,
        { diameter: 0.6, segments: 8 },
        this.scene,
      )
      thresholdEndLight.position.set(side * (runwayWidthM / 2 + 3), 1, 0)
      thresholdEndLight.material = redMat // Red facing into runway
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(thresholdEndLight)
      }
      this.runwayLights.push(thresholdEndLight)
    }

    // At far end - green outward (for opposite direction approaches)
    for (let side = -1; side <= 1; side += 2) {
      const farEndLight = BABYLON.MeshBuilder.CreateSphere(
        `far_end_green_${side}`,
        { diameter: 0.6, segments: 8 },
        this.scene,
      )
      farEndLight.position.set(side * (runwayWidthM / 2 + 3), 1, runwayLengthM)
      farEndLight.material = greenMat // Green facing outward
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(farEndLight)
      }
      this.runwayLights.push(farEndLight)
    }
  }

  private createApproachLights(type: LightingType): void {
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    const whiteMat = new BABYLON.StandardMaterial('approachWhite', this.scene)
    whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    const redMat = new BABYLON.StandardMaterial('approachRed', this.scene)
    redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    const strobeMat = new BABYLON.StandardMaterial('strobe', this.scene)
    strobeMat.emissiveColor = new BABYLON.Color3(1, 1, 0.9)
    strobeMat.diffuseColor = new BABYLON.Color3(1, 1, 0.9)

    switch (type) {
      case 'ALSF-II': {
        // ALSF-II: 2400 ft length with decision bar at 1000 ft
        // Centerline lights every 100 ft (30.48m)
        for (let ft = 100; ft <= 2400; ft += 100) {
          const z = -feetToMeters(ft)
          const centerLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_center_${ft}`,
            { diameter: 0.6, segments: 8 }, // Small approach light
            this.scene,
          )
          centerLight.position.set(0, 2, z)
          centerLight.material = whiteMat
          this.approachLights.push(centerLight)
        }

        // Decision bar at 1000 ft (38 lights across 150 ft)
        const decisionZ = -feetToMeters(1000)
        for (let x = -22.86; x <= 22.86; x += 1.2) {
          const decisionLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_decision_${x}`,
            { diameter: 0.5, segments: 8 }, // Small decision bar light
            this.scene,
          )
          decisionLight.position.set(x, 2, decisionZ)
          decisionLight.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(decisionLight)
          }
          this.approachLights.push(decisionLight)
        }

        // Red side row bars from terminating bar (200 ft) to runway threshold (0 ft)
        // Plus from 500-1000 ft as per standard ALSF-2
        const redSideRowPositions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
        for (const ft of redSideRowPositions) {
          const z = -feetToMeters(ft)
          // Left side (10 lights)
          for (let i = 0; i < 10; i++) {
            const x = -9.14 - i * 0.91
            const sideLight = BABYLON.MeshBuilder.CreateSphere(
              `alsf2_left_${ft}_${i}`,
              { diameter: 0.4, segments: 8 }, // Small side light
              this.scene,
            )
            sideLight.position.set(x, 2, z)
            sideLight.material = redMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(sideLight)
            }
            this.approachLights.push(sideLight)
          }
          // Right side (10 lights)
          for (let i = 0; i < 10; i++) {
            const x = 9.14 + i * 0.91
            const sideLight = BABYLON.MeshBuilder.CreateSphere(
              `alsf2_right_${ft}_${i}`,
              { diameter: 0.4, segments: 8 }, // Small side light
              this.scene,
            )
            sideLight.position.set(x, 2, z)
            sideLight.material = redMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(sideLight)
            }
            this.approachLights.push(sideLight)
          }
        }

        // Touchdown Zone Lights (TDZL) - white lights from threshold to 3000 ft
        // Same geometry as side row lights but white instead of red
        for (let ft = 100; ft <= 3000; ft += 100) {
          const z = feetToMeters(ft) // Positive Z since these are on the runway
          // Left side row (10 lights)
          for (let i = 0; i < 10; i++) {
            const x = -9.14 - i * 0.91 // Same spacing as red side rows
            const tdzLight = BABYLON.MeshBuilder.CreateSphere(
              `alsf2_tdzl_left_${ft}_${i}`,
              { diameter: 0.4, segments: 8 }, // Same size as side row lights
              this.scene,
            )
            tdzLight.position.set(x, 1, z)
            tdzLight.material = whiteMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(tdzLight)
            }
            this.runwayLights.push(tdzLight) // Add to runway lights array since they're on the runway
          }
          // Right side row (10 lights)
          for (let i = 0; i < 10; i++) {
            const x = 9.14 + i * 0.91 // Same spacing as red side rows
            const tdzLight = BABYLON.MeshBuilder.CreateSphere(
              `alsf2_tdzl_right_${ft}_${i}`,
              { diameter: 0.4, segments: 8 }, // Same size as side row lights
              this.scene,
            )
            tdzLight.position.set(x, 1, z)
            tdzLight.material = whiteMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(tdzLight)
            }
            this.runwayLights.push(tdzLight) // Add to runway lights array since they're on the runway
          }
        }

        // Light bars at 500 ft intervals (500, 1500, 2000 ft)
        const barPositions = [500, 1500, 2000]
        for (const ft of barPositions) {
          const z = -feetToMeters(ft)
          for (let x = -13.7; x <= 13.7; x += 2.74) {
            if (Math.abs(x) > 1) {
              const barLight = BABYLON.MeshBuilder.CreateSphere(
                `alsf2_bar_${ft}_${x}`,
                { diameter: 0.5, segments: 8 }, // Small bar light
                this.scene,
              )
              barLight.position.set(x, 2, z)
              barLight.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(barLight)
              }
              this.approachLights.push(barLight)
            }
          }
        }

        // Sequenced flashers every 200 ft from 200-2200 ft
        for (let ft = 200; ft <= 2200; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_seq_${ft}`,
            { diameter: 2, segments: 8 }, // Larger for sequenced flashers
            this.scene,
          )
          flasher.position.set(0, 3, z)
          flasher.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(flasher)
          }
          this.sequencedFlashers.push(flasher)
          this.approachLights.push(flasher)
        }

        this.startRabbitSequence()
        break
      }

      case 'ALSF-I': {
        // ALSF-I: Same as ALSF-II but with terminating bar instead of red side rows
        // Centerline lights every 100 ft
        for (let ft = 100; ft <= 2400; ft += 100) {
          const z = -feetToMeters(ft)
          const centerLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_center_${ft}`,
            { diameter: 0.6, segments: 8 }, // Small approach light
            this.scene,
          )
          centerLight.position.set(0, 2, z)
          centerLight.material = whiteMat
          this.approachLights.push(centerLight)
        }

        // Decision bar at 1000 ft
        const decisionZ = -feetToMeters(1000)
        for (let x = -22.86; x <= 22.86; x += 1.2) {
          const decisionLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_decision_${x}`,
            { diameter: 0.5, segments: 8 }, // Small light
            this.scene,
          )
          decisionLight.position.set(x, 2, decisionZ)
          decisionLight.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(decisionLight)
          }
          this.approachLights.push(decisionLight)
        }

        // Terminating bar at 200 ft (red lights in wing shape)
        const termZ = -feetToMeters(200)
        // Left wing
        for (let i = 0; i < 8; i++) {
          const x = -4 - i * 1.5
          const wingLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_wing_left_${i}`,
            { diameter: 0.5, segments: 8 }, // Small light
            this.scene,
          )
          wingLight.position.set(x, 2, termZ - i * 0.5)
          wingLight.material = redMat
          this.approachLights.push(wingLight)
        }
        // Right wing
        for (let i = 0; i < 8; i++) {
          const x = 4 + i * 1.5
          const wingLight = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_wing_right_${i}`,
            { diameter: 0.5, segments: 8 }, // Small light
            this.scene,
          )
          wingLight.position.set(x, 2, termZ - i * 0.5)
          wingLight.material = redMat
          this.approachLights.push(wingLight)
        }

        // Light bars at 500 ft intervals
        const barPositions = [500, 1500, 2000]
        for (const ft of barPositions) {
          const z = -feetToMeters(ft)
          for (let x = -13.7; x <= 13.7; x += 2.74) {
            if (Math.abs(x) > 1) {
              const barLight = BABYLON.MeshBuilder.CreateSphere(
                `alsf1_bar_${ft}_${x}`,
                { diameter: 0.5, segments: 8 }, // Small light
                this.scene,
              )
              barLight.position.set(x, 2, z)
              barLight.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(barLight)
              }
              this.approachLights.push(barLight)
            }
          }
        }

        // Sequenced flashers
        for (let ft = 200; ft <= 2200; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_seq_${ft}`,
            { diameter: 2, segments: 8 }, // Larger for sequenced flashers
            this.scene,
          )
          flasher.position.set(0, 3, z)
          flasher.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(flasher)
          }
          this.sequencedFlashers.push(flasher)
          this.approachLights.push(flasher)
        }

        this.startRabbitSequence()
        break
      }

      case 'MALSR': {
        // MALSR: 2400 ft with lights every 200 ft
        // Centerline lights every 200 ft (61m)
        for (let ft = 200; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const centerLight = BABYLON.MeshBuilder.CreateSphere(
            `malsr_center_${ft}`,
            { diameter: 0.6, segments: 8 }, // Small approach light
            this.scene,
          )
          centerLight.position.set(0, 2, z)
          centerLight.material = whiteMat
          this.approachLights.push(centerLight)
        }

        // Triple bar at 1000 ft (15 lights across 40 ft)
        const decisionZ = -feetToMeters(1000)
        for (let x = -6.1; x <= 6.1; x += 0.87) {
          const barLight = BABYLON.MeshBuilder.CreateSphere(
            `malsr_bar_${x}`,
            { diameter: 0.5, segments: 8 }, // Small light
            this.scene,
          )
          barLight.position.set(x, 2, decisionZ)
          barLight.material = whiteMat
          this.approachLights.push(barLight)
        }

        // Light bars at 200, 400, 600, 800, 1200, 1400, 1600, 1800, 2000, 2200, 2400 ft
        // (5 lights each, 20 ft spacing)
        for (let ft = 200; ft <= 2400; ft += 200) {
          if (ft !== 1000) {
            // Skip 1000 ft as it has the triple bar
            const z = -feetToMeters(ft)
            for (let i = -2; i <= 2; i++) {
              const x = i * 3.05 // 10 ft spacing
              const barLight = BABYLON.MeshBuilder.CreateSphere(
                `malsr_bar_${ft}_${i}`,
                { diameter: 0.5, segments: 8 }, // Small light
                this.scene,
              )
              barLight.position.set(x, 2, z)
              barLight.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(barLight)
              }
              this.approachLights.push(barLight)
            }
          }
        }

        // Sequenced flashers every 200 ft
        for (let ft = 200; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `malsr_seq_${ft}`,
            { diameter: 2, segments: 8 }, // Larger for sequenced flashers
            this.scene,
          )
          flasher.position.set(0, 3, z)
          flasher.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(flasher)
          }
          this.sequencedFlashers.push(flasher)
          this.approachLights.push(flasher)
        }

        // REIL (Runway End Identifier Lights)
        for (let side = -1; side <= 1; side += 2) {
          const reil = BABYLON.MeshBuilder.CreateSphere(
            `malsr_reil_${side}`,
            { diameter: 2, segments: 8 }, // Same size as sequenced flashers
            this.scene,
          )
          reil.position.set(side * (runwayWidthM / 2 + 10), 3, -30)
          reil.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(reil)
          }
          this.reilLights.push(reil)
        }
        this.startRabbitSequence() // Add sequenced flashing for MALSR
        this.startREILFlashing()
        break
      }

      case 'SSALR': {
        // SSALR: Simplified Short Approach Lighting with REIL
        // 2400 ft length, similar to MALSR but with higher intensity
        // Centerline lights every 200 ft
        for (let ft = 200; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const centerLight = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_center_${ft}`,
            { diameter: 0.6, segments: 8 }, // Small approach light
            this.scene,
          )
          centerLight.position.set(0, 2, z)
          centerLight.material = whiteMat
          this.approachLights.push(centerLight)
        }

        // Bar at 1000 ft (5 lights)
        const decisionZ = -feetToMeters(1000)
        for (let i = -2; i <= 2; i++) {
          const x = i * 4.57 // 15 ft spacing
          const barLight = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_bar_${i}`,
            { diameter: 0.6, segments: 8 }, // Small approach light
            this.scene,
          )
          barLight.position.set(x, 2, decisionZ)
          barLight.material = whiteMat
          this.approachLights.push(barLight)
        }

        // Sequenced flashers every 200 ft (higher intensity)
        for (let ft = 200; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_seq_${ft}`,
            { diameter: 2, segments: 8 }, // Same size as other sequenced flashers
            this.scene,
          )
          flasher.position.set(0, 3, z)
          flasher.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(flasher)
          }
          this.sequencedFlashers.push(flasher)
          this.approachLights.push(flasher)
        }

        // REIL (high intensity)
        for (let side = -1; side <= 1; side += 2) {
          const reil = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_reil_${side}`,
            { diameter: 2, segments: 8 }, // Same size as sequenced flashers
            this.scene,
          )
          reil.position.set(side * (runwayWidthM / 2 + 10), 3, -30)
          reil.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(reil)
          }
          this.reilLights.push(reil)
        }
        this.startRabbitSequence() // Add sequenced flashing for SSALR
        this.startREILFlashing()
        break
      }

      case 'REIL': {
        for (let side = -1; side <= 1; side += 2) {
          const reil = BABYLON.MeshBuilder.CreateSphere(
            `reil_${side}`,
            { diameter: 2, segments: 8 }, // Same size as sequenced flashers
            this.scene,
          )
          reil.position.set(side * (runwayWidthM / 2 + 10), 3, -30)
          reil.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(reil)
          }
          this.reilLights.push(reil)
        }
        this.startREILFlashing()
        break
      }
    }
  }

  private setupWeatherEffects(): void {
    this.updateFogDistance()
    this.setupSimpleCloudEffect()
    this.setupCloudParticles()
  }

  private setupCloudParticles(): void {
    // Clean up existing particles
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
      this.cloudParticles = null
    }

    // Create particle system for static cloud wisps (motion from camera movement only)
    const particleSystem = new BABYLON.ParticleSystem('cloudParticles', 500, this.scene)
    particleSystem.disposeOnStop = false // Don't dispose when stopped, we'll reuse it

    // Create a procedural cloud texture
    const cloudTexture = new BABYLON.DynamicTexture('cloudTexture', 256, this.scene, false)
    const ctx = cloudTexture.getContext()

    // Clear canvas
    ctx.clearRect(0, 0, 256, 256)

    // Create main soft cloud shape with smooth gradient
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 120)
    gradient.addColorStop(0, 'rgba(240, 240, 240, 0.6)') // Light gray center
    gradient.addColorStop(0.2, 'rgba(230, 230, 230, 0.4)') // Gradual fade
    gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.2)') // Softer edges
    gradient.addColorStop(0.8, 'rgba(210, 210, 210, 0.05)')
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0)') // Transparent edge

    // Fill with main gradient
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)

    // Add very subtle larger cloud formations (not dots)
    for (let i = 0; i < 3; i++) {
      const x = 128 + (Math.random() - 0.5) * 80
      const y = 128 + (Math.random() - 0.5) * 80
      const radius = Math.random() * 60 + 40 // Larger, softer areas
      const softGradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius)
      softGradient.addColorStop(0, 'rgba(235, 235, 235, 0.1)') // Very subtle
      softGradient.addColorStop(0.7, 'rgba(225, 225, 225, 0.05)')
      softGradient.addColorStop(1, 'rgba(215, 215, 215, 0)')
      ctx.fillStyle = softGradient
      ctx.fillRect(0, 0, 256, 256)
    }

    cloudTexture.update()
    particleSystem.particleTexture = cloudTexture

    // Create a box in front of camera for static cloud field
    const emitterBox = BABYLON.MeshBuilder.CreateBox('cloudEmitter', { size: 1 }, this.scene)
    emitterBox.isVisible = false
    emitterBox.parent = this.camera
    emitterBox.position = new BABYLON.Vector3(0, 0, 20) // Position ahead of camera

    particleSystem.emitter = emitterBox
    particleSystem.minEmitBox = new BABYLON.Vector3(-100, -30, -50)
    particleSystem.maxEmitBox = new BABYLON.Vector3(100, 30, 50)

    // Particle appearance - more visible in day mode
    if (this.isDarkMode) {
      particleSystem.color1 = new BABYLON.Color4(0.95, 0.95, 0.95, 0.4)
      particleSystem.color2 = new BABYLON.Color4(0.9, 0.9, 0.9, 0.2)
      particleSystem.colorDead = new BABYLON.Color4(0.9, 0.9, 0.9, 0)
    } else {
      // Darker, more visible cloud particles in day mode
      particleSystem.color1 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.5)
      particleSystem.color2 = new BABYLON.Color4(0.65, 0.65, 0.65, 0.3)
      particleSystem.colorDead = new BABYLON.Color4(0.7, 0.7, 0.7, 0)
    }

    particleSystem.minSize = 20
    particleSystem.maxSize = 40

    particleSystem.minLifeTime = 3
    particleSystem.maxLifeTime = 5

    particleSystem.emitRate = 50

    // No intrinsic motion - particles remain stationary in world space
    particleSystem.direction1 = new BABYLON.Vector3(0, 0, 0)
    particleSystem.direction2 = new BABYLON.Vector3(0, 0, 0)

    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0)
    particleSystem.minAngularSpeed = 0
    particleSystem.maxAngularSpeed = 0

    particleSystem.minEmitPower = 0
    particleSystem.maxEmitPower = 0
    particleSystem.updateSpeed = 0.01

    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD

    this.cloudParticles = particleSystem
  }

  private setupSimpleCloudEffect(): void {
    // Enhanced cloud effect with smooth transitions
    const updateCloudFog = () => {
      const altitude = this.animationStore.currentAltitude
      const ceiling = this.approachStore.effectiveCeiling
      const currentlyInClouds = altitude > ceiling

      // Track transition timing
      if (currentlyInClouds !== this.lastAltitudeInClouds) {
        this.cloudTransitionTime = Date.now()
        this.lastAltitudeInClouds = currentlyInClouds
      }

      const transitionDuration = 500 // 0.5 seconds
      const timeSinceTransition = Date.now() - this.cloudTransitionTime
      const transitionProgress = Math.min(1, timeSinceTransition / transitionDuration)

      // Update glow layer intensity based on altitude relative to cloud layer
      if (this.glowLayer) {
        const baseIntensity = this.isDarkMode ? 2.5 : 1.2

        if (altitude > ceiling + 50) {
          // Well above clouds - no glow visible
          this.glowLayer.intensity = 0
        } else if (altitude > ceiling) {
          // In transition zone (ceiling to ceiling+50) - gradual glow appearance
          const transitionFactor = 1 - (altitude - ceiling) / 50
          // Start at 20% and increase to 80% as we approach ceiling
          this.glowLayer.intensity = baseIntensity * (0.2 + 0.6 * transitionFactor)
        } else if (altitude > ceiling - 50) {
          // Just below ceiling - increasing glow visibility
          const breakoutFactor = (ceiling - altitude) / 50
          // From 80% to 100% intensity
          this.glowLayer.intensity = baseIntensity * (0.8 + 0.2 * breakoutFactor)
        } else {
          // Clear below clouds - full glow
          this.glowLayer.intensity = baseIntensity
        }
      }

      if (altitude > ceiling + 50) {
        // Well above clouds - complete whiteout with particles
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2
        this.scene.fogDensity = 1.0
        if (this.isDarkMode) {
          // Dark gray clouds at night
          this.scene.fogColor = new BABYLON.Color3(0.5, 0.5, 0.5)
          this.scene.clearColor = new BABYLON.Color4(0.5, 0.5, 0.5, 1)
        } else {
          // Light gray clouds during day for better visibility
          this.scene.fogColor = new BABYLON.Color3(0.75, 0.75, 0.75)
          this.scene.clearColor = new BABYLON.Color4(0.75, 0.75, 0.75, 1)
        }

        // Only start particles if not paused
        if (
          this.cloudParticles &&
          !this.cloudParticles.isStarted() &&
          this.animationStore.isPlaying &&
          !this.animationStore.isPaused
        ) {
          this.cloudParticles.start()
        }
      } else if (altitude > ceiling) {
        // In transition zone - smooth animated transition
        const altitudeTransition = (altitude - ceiling) / 50
        const smoothTransition = altitudeTransition * transitionProgress

        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2
        this.scene.fogDensity = 0.2 + 0.8 * smoothTransition

        // Smooth color transition - respect dark mode
        if (this.isDarkMode) {
          // Night clouds are dark gray
          const intensity = 0.3 + 0.4 * smoothTransition
          this.scene.fogColor = new BABYLON.Color3(intensity, intensity, intensity)
          this.scene.clearColor = new BABYLON.Color4(intensity, intensity, intensity, 1)
        } else {
          // Day clouds transition from gray sky to light gray clouds
          const r = 0.55 + 0.2 * smoothTransition
          const g = 0.57 + 0.18 * smoothTransition
          const b = 0.6 + 0.15 * smoothTransition
          this.scene.fogColor = new BABYLON.Color3(r, g, b)
          this.scene.clearColor = new BABYLON.Color4(r, g, b, 1)
        }

        // Fade particles during transition (only if not paused)
        if (this.cloudParticles) {
          if (
            !this.cloudParticles.isStarted() &&
            this.animationStore.isPlaying &&
            !this.animationStore.isPaused
          ) {
            this.cloudParticles.start()
          }
          this.cloudParticles.emitRate = 100 * smoothTransition
        }
      } else {
        // Below clouds - gray overcast sky in day mode, dark sky at night
        this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR

        // Under cloud layer - show gray overcast sky in day mode
        if (this.isDarkMode) {
          this.scene.fogColor = new BABYLON.Color3(0.06, 0.06, 0.14) // Night fog
          this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1) // Night sky
        } else {
          // Gray overcast sky when under clouds in day mode
          this.scene.fogColor = new BABYLON.Color3(0.55, 0.57, 0.6) // Gray fog
          this.scene.clearColor = new BABYLON.Color4(0.5, 0.52, 0.55, 1) // Gray overcast sky
        }

        this.updateFogDistance()

        // Stop particles when below clouds
        if (this.cloudParticles && this.cloudParticles.isStarted()) {
          this.cloudParticles.stop()
        }
      }
    }

    // Update on each frame
    this.scene.registerBeforeRender(updateCloudFog)
  }

  private updateFogDistance(): void {
    let visibilityMeters: number
    if (this.approachStore.visibilityUnit === 'RVR') {
      // RVR is already the actual visibility distance in feet
      // Convert directly to meters (don't convert to SM first)
      visibilityMeters = this.approachStore.effectiveVisibility * 0.3048 // feet to meters
    } else {
      visibilityMeters = statuteMilesToMeters(this.approachStore.effectiveVisibility)
    }

    // Realistic fog for RVR/visibility
    // RVR is the distance you can see runway lights/markings
    // Fog should obscure things beyond this distance
    if (this.approachStore.visibilityUnit === 'RVR') {
      // For RVR, fog should match the reported visibility very closely
      // RVR is measured as the distance a pilot can see runway lights/markings
      // Start fog immediately, reach 50% opacity at 50% of RVR, full fog at 80% of RVR
      this.scene.fogStart = visibilityMeters * 0.1 // Start fog very close (10% of RVR)
      this.scene.fogEnd = visibilityMeters * 0.8 // Full fog at 80% of RVR

      // Also increase fog density for RVR conditions
      this.scene.fogDensity = 0.01
    } else {
      // For statute miles, a bit more generous since it's prevailing visibility
      // Start fog at 30% of visibility, full fog at 100%
      this.scene.fogStart = visibilityMeters * 0.3
      this.scene.fogEnd = visibilityMeters * 1.0
      this.scene.fogDensity = 0.005
    }
  }

  private setupCloudEffect(): void {
    // Remove old post process
    if (this.fogPostProcess) {
      this.fogPostProcess.dispose()
      this.fogPostProcess = null
    }

    // Create fog/cloud post-processing effect
    const postProcessCode = `
      precision highp float;
      
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float cameraAltitude;
      uniform float cloudCeiling;
      uniform float visibility;
      
      void main(void) {
        vec4 color = texture2D(textureSampler, vUV);
        
        // Check if we're in clouds - only when actually at or below ceiling height
        float inClouds = 0.0;
        if (cameraAltitude <= cloudCeiling + 50.0 && cameraAltitude >= cloudCeiling - 50.0) {
          // In the cloud layer
          float distFromCeiling = abs(cameraAltitude - cloudCeiling);
          if (distFromCeiling < 10.0) {
            inClouds = 1.0;
          } else {
            inClouds = 1.0 - smoothstep(10.0, 50.0, distFromCeiling);
          }
        }
        
        // Cloud color (gray-white)
        vec3 cloudColor = vec3(0.9, 0.9, 0.92);
        
        // Mix original color with cloud
        color.rgb = mix(color.rgb, cloudColor, inClouds * 0.95);
        
        gl_FragColor = color;
      }
    `

    // Create the effect first
    BABYLON.Effect.ShadersStore['cloudFogFragmentShader'] = postProcessCode

    this.fogPostProcess = new BABYLON.PostProcess(
      'cloudFog',
      'cloudFog',
      ['cameraAltitude', 'cloudCeiling', 'visibility'],
      [],
      1.0,
      this.camera,
    )

    this.fogPostProcess.onApply = (effect) => {
      const altitudeFeet = this.animationStore.currentAltitude
      const ceilingFeet = this.approachStore.effectiveCeiling

      effect.setFloat('cameraAltitude', altitudeFeet)
      effect.setFloat('cloudCeiling', ceilingFeet)
      effect.setFloat('visibility', this.approachStore.effectiveVisibility)
    }
  }

  private resetCameraPosition(): void {
    const distanceNm = this.animationStore.startingDistanceNm
    const altitudeMeters = feetToMeters(this.animationStore.currentAltitude)
    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)

    // Distance to touchdown zone (not threshold)
    const distanceToTDZ = Math.max(0, distanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM)
    const distanceToTDZMeters = distanceToTDZ * FEET_PER_NM * 0.3048

    // Position camera on glidepath
    this.camera.position = new BABYLON.Vector3(0, altitudeMeters, tdzMeters - distanceToTDZMeters)

    // Look at touchdown zone
    this.camera.setTarget(new BABYLON.Vector3(0, 0, tdzMeters))
  }

  private updateCameraPosition(): void {
    const distanceNm = this.animationStore.currentDistanceNm
    const altitudeMeters = feetToMeters(this.animationStore.currentAltitude)
    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)

    // Distance to touchdown zone (not threshold)
    const distanceToTDZ = Math.max(0, distanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM)
    const distanceToTDZMeters = distanceToTDZ * FEET_PER_NM * 0.3048

    // Position camera on glidepath - when distanceToTDZ is 0, we're at the TDZ
    this.camera.position.z = tdzMeters - distanceToTDZMeters
    this.camera.position.y = altitudeMeters

    // Check if this is a non-precision or circling approach
    const isNonPrecision =
      this.approachStore.selectedMinimumId === 'non-precision' ||
      this.approachStore.selectedMinimumId === 'circling'

    // For non-precision approaches, check if we're at or below MDA
    if (isNonPrecision) {
      const ceiling = this.approachStore.effectiveCeiling
      const angleRadians = (3 * Math.PI) / 180 // 3 degree glideslope

      // Calculate what altitude we would be at on a 3° glideslope
      const glidepathAltitude = distanceToTDZ * FEET_PER_NM * Math.tan(angleRadians)

      // If we're level at MDA (current altitude equals ceiling and below glidepath)
      if (this.animationStore.currentAltitude <= ceiling && glidepathAltitude < ceiling) {
        // Look straight ahead (parallel to runway)
        this.camera.setTarget(new BABYLON.Vector3(0, altitudeMeters, tdzMeters + 1000))
      } else {
        // Still descending, look at touchdown zone
        this.camera.setTarget(new BABYLON.Vector3(0, 0, tdzMeters))
      }
    } else {
      // Precision approach - always look at touchdown zone
      this.camera.setTarget(new BABYLON.Vector3(0, 0, tdzMeters))
    }
  }

  private update(): void {
    const currentTime = Date.now()
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = currentTime
      return
    }
    const deltaTime = currentTime - this.lastFrameTime
    this.lastFrameTime = currentTime

    if (this.animationStore.isPlaying && !this.animationStore.isPaused) {
      this.animationStore.updatePosition(deltaTime)
      this.updateCameraPosition()
      this.updatePAPILights()
    } else {
      // Always update camera position when not actively animating
      this.updateCameraPosition()
      this.updatePAPILights()
    }

    if (this.animationStore.isPaused) {
      // When paused, stop particle emission to prevent accumulation
      if (this.cloudParticles && this.cloudParticles.isStarted()) {
        this.cloudParticles.stop()
      }
    }

    if (
      !this.animationStore.isPlaying &&
      Math.abs(this.animationStore.currentDistanceNm - this.animationStore.startingDistanceNm) <
        0.01
    ) {
      this.resetCameraPosition()
    }
  }

  public updateSettings(): void {
    this.updateLighting()
    this.setupWeatherEffects()
    if (!this.animationStore.isPlaying) {
      this.resetCameraPosition()
    }
  }

  private startREILFlashing(): void {
    // Clear any existing interval
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
    }

    // Flash REILs at 2Hz (twice per second) by toggling visibility and glow
    let visible = true
    this.reilFlashInterval = setInterval(() => {
      this.reilLights.forEach((light) => {
        light.isVisible = visible
        // Also remove/add from glow layer for complete flash effect
        if (this.glowLayer) {
          if (visible) {
            this.glowLayer.addIncludedOnlyMesh(light)
          } else {
            this.glowLayer.removeIncludedOnlyMesh(light)
          }
        }
      })
      visible = !visible
    }, 250) as unknown as number
  }

  private checkDarkMode(): void {
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  private updateSceneForDarkMode(): void {
    this.setupScene()
    this.updateLighting()

    // Update ground material
    const ground = this.scene.getMeshByName('ground')
    if (ground && ground.material) {
      const mat = ground.material as BABYLON.StandardMaterial
      mat.diffuseColor = this.isDarkMode
        ? new BABYLON.Color3(0.03, 0.04, 0.03) // Dark grass with subtle green
        : new BABYLON.Color3(0.1, 0.2, 0.1)
      mat.emissiveColor = this.isDarkMode
        ? new BABYLON.Color3(0.01, 0.01, 0.01) // Subtle moonlight glow
        : new BABYLON.Color3(0, 0, 0)
    }

    // Update runway material
    const runway = this.scene.getMeshByName('runway')
    if (runway && runway.material) {
      const mat = runway.material as BABYLON.StandardMaterial
      mat.diffuseColor = this.isDarkMode
        ? new BABYLON.Color3(0.15, 0.15, 0.17) // Dark asphalt with blue tint
        : new BABYLON.Color3(0.3, 0.3, 0.3)
      mat.specularColor = this.isDarkMode
        ? new BABYLON.Color3(0.02, 0.02, 0.03)
        : new BABYLON.Color3(0.1, 0.1, 0.1)
    }

    // Update glow layer intensity for dark/light mode
    if (this.glowLayer) {
      this.glowLayer.intensity = this.isDarkMode ? 2.5 : 1.2
    }
  }

  private createPAPILights(): void {
    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    // Create materials for PAPI lights
    this.papiRedMat = new BABYLON.StandardMaterial('papiRed', this.scene)
    this.papiRedMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    this.papiRedMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    this.papiWhiteMat = new BABYLON.StandardMaterial('papiWhite', this.scene)
    this.papiWhiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    this.papiWhiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    const papiSpacing = feetToMeters(30)
    const papiStartX = -(runwayWidthM / 2 + feetToMeters(50))
    const papiY = 2
    const papiZ = tdzMeters

    // PAPI lights should be perpendicular to runway (varying X position)
    for (let i = 0; i < 4; i++) {
      const papi = BABYLON.MeshBuilder.CreateSphere(
        `papi_${i}`,
        { diameter: 1.5, segments: 8 }, // Medium size for PAPI
        this.scene,
      )
      papi.position.set(
        papiStartX - i * papiSpacing, // Vary X position instead of Z
        papiY,
        papiZ, // Keep Z constant at touchdown zone
      )
      // Initially set to 2 red, 2 white (on glidepath)
      papi.material = i < 2 ? this.papiRedMat : this.papiWhiteMat
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(papi)
      }
      this.papiLights.push(papi)
    }
  }

  private updatePAPILights(): void {
    if (this.papiLights.length !== 4 || !this.papiRedMat || !this.papiWhiteMat) return

    // Calculate current glidepath angle
    const altitude = this.animationStore.currentAltitude
    const distanceToTDZ = Math.max(
      0,
      this.animationStore.currentDistanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM,
    )
    const distanceFt = distanceToTDZ * FEET_PER_NM

    // Avoid division by zero
    if (distanceFt <= 0) return

    // Calculate angle in degrees
    const angleRadians = Math.atan(altitude / distanceFt)
    const angleDegrees = (angleRadians * 180) / Math.PI

    // Determine PAPI configuration based on angle
    // PAPI angles: 2.5° (all red), 2.75° (1W 3R), 3.0° (2W 2R), 3.25° (3W 1R), 3.5° (all white)
    let redCount = 2 // Default to on glidepath

    if (angleDegrees >= 3.5) {
      redCount = 0 // All white - too high
    } else if (angleDegrees >= 3.25) {
      redCount = 1 // 3 white, 1 red - slightly high
    } else if (angleDegrees >= 2.75) {
      redCount = 2 // 2 white, 2 red - on glidepath
    } else if (angleDegrees >= 2.5) {
      redCount = 3 // 1 white, 3 red - slightly low
    } else {
      redCount = 4 // All red - too low
    }

    // Update light colors
    for (let i = 0; i < 4; i++) {
      this.papiLights[i].material = i < redCount ? this.papiRedMat : this.papiWhiteMat
    }
  }

  private startRabbitSequence(): void {
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
    }

    let currentIndex = this.sequencedFlashers.length - 1

    this.rabbitInterval = setInterval(() => {
      this.sequencedFlashers.forEach((flasher) => {
        flasher.isVisible = false
      })

      if (currentIndex >= 0 && currentIndex < this.sequencedFlashers.length) {
        this.sequencedFlashers[currentIndex].isVisible = true
      }

      currentIndex--
      if (currentIndex < 0) {
        currentIndex = this.sequencedFlashers.length - 1
      }
    }, 100) as unknown as number
  }

  public dispose(): void {
    if (this.fogPostProcess) {
      this.fogPostProcess.dispose()
    }
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
    }
    if (this.reilFlashInterval) {
      clearInterval(this.reilFlashInterval)
    }
    if (this.rabbitInterval) {
      clearInterval(this.rabbitInterval)
    }
    this.engine.dispose()
  }
}
