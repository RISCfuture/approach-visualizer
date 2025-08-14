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
    markingMat.emissiveColor = this.isDarkMode
      ? new BABYLON.Color3(0.15, 0.15, 0.15)
      : new BABYLON.Color3(0.8, 0.8, 0.8)

    // ============================================
    // CENTERLINE - Always visible on precision runways
    // ============================================
    const centerlineStripeLengthFt = 120
    const centerlineGapFt = 80
    const centerlineWidthFt = 3
    const centerlineStripeLength = feetToMeters(centerlineStripeLengthFt)
    const centerlineGap = feetToMeters(centerlineGapFt)
    const centerlineWidth = feetToMeters(centerlineWidthFt)
    
    const centerlineStart = feetToMeters(500)
    const centerlineInterval = centerlineStripeLength + centerlineGap
    const numCenterlines = Math.floor((length - centerlineStart) / centerlineInterval)

    for (let i = 0; i < numCenterlines; i++) {
      const centerline = BABYLON.MeshBuilder.CreateBox(
        `centerline_${i}`,
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

    // ============================================
    // RUNWAY DESIGNATION NUMBERS - Always visible
    // ============================================
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
    // Always create runway numbers
    createNumber09()
    
    // ============================================
    // THRESHOLD MARKINGS
    // ============================================
    if (this.approachStore.showThresholdMarkings) {
      // Threshold stripes (piano keys)
      const thresholdStripeWidth = feetToMeters(5.75)
      const thresholdStripeLength = feetToMeters(150)
      const thresholdSpacing = feetToMeters(5.75)
      const thresholdStartZ = 0
      
      // 12 stripes total (6 on each side)
      for (let i = 0; i < 6; i++) {
        for (let side = -1; side <= 1; side += 2) {
          const threshold = BABYLON.MeshBuilder.CreateBox(
            `threshold_${side}_${i}`,
            {
              width: thresholdStripeWidth,
              height: 0.05,
              depth: thresholdStripeLength,
            },
            this.scene,
          )
          const xPos = side * (feetToMeters(11.5) + i * (thresholdStripeWidth + thresholdSpacing))
          threshold.position.x = xPos
          threshold.position.z = thresholdStartZ + thresholdStripeLength / 2
          threshold.position.y = 0.2
          threshold.material = markingMat
        }
      }
    }

    // ============================================
    // SIDE STRIPES - Edge markings for precision runways
    // ============================================
    if (this.approachStore.showSideStripes) {
      // Create continuous edge stripes along both sides of the runway
      const edgeStripeWidth = feetToMeters(3) // 3 ft wide edge stripes
      
      for (let side = -1; side <= 1; side += 2) {
        const edgeStripe = BABYLON.MeshBuilder.CreateBox(
          `edgeStripe_${side}`,
          {
            width: edgeStripeWidth,
            height: 0.05,
            depth: length * 0.9, // Cover most of the runway length
          },
          this.scene,
        )
        edgeStripe.position.x = side * (width / 2 - edgeStripeWidth / 2 - feetToMeters(2)) // 2ft from edge
        edgeStripe.position.z = length * 0.45 // Center it along runway
        edgeStripe.position.y = 0.2
        edgeStripe.material = markingMat
      }
    }

    // ============================================
    // AIMING POINT MARKINGS
    // ============================================
    if (this.approachStore.showAimPoint) {
      const aimingPointLengthFt = 150
      const aimingPointWidthFt = 20
      const aimingPointLength = feetToMeters(aimingPointLengthFt)
      const aimingPointWidth = feetToMeters(aimingPointWidthFt)
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
    }

    // ============================================
    // TOUCHDOWN ZONE MARKINGS
    // ============================================
    // Pattern: 3 bars at 500ft, 2 bars at 1000ft (covered by aiming point),
    // 1 bar at 1500ft, 2 bars at 2000ft, 3 bars at 2500ft
    if (this.approachStore.showTouchdownZone) {
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
    if (this.approachStore.showPAPI) {
      this.createPAPILights()
    }
    
    // Create standalone REIL lights if enabled
    if (this.approachStore.showREIL && this.reilLights.length === 0) {
      this.createREILLights()
    }

    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)

    // Edge lights
    if (this.approachStore.showEdgeLights) {
      const lightSpacing = 60

      const whiteMat = new BABYLON.StandardMaterial('whiteLight', this.scene)
      whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
      whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

      const yellowMat = new BABYLON.StandardMaterial('yellowLight', this.scene)
      yellowMat.emissiveColor = new BABYLON.Color3(1, 1, 0)
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

      const numLights = Math.floor(runwayLengthM / lightSpacing)
      for (let i = 0; i <= numLights; i++) {
        const z = i * lightSpacing
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

      // Threshold lights (green) - skip if system has its own threshold bar
      const hasOwnThresholdBar = ['ALSF-II', 'ALSF-I', 'SSALR', 'MALS', 'MALSF', 'MALSR'].includes(this.approachStore.lightingType)
      if (!hasOwnThresholdBar) {
        for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
          const thresholdLight = BABYLON.MeshBuilder.CreateSphere(
            `threshold_${x}`,
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
      }

      // Runway end lights (red toward runway for departing aircraft)
      for (let x = -runwayWidthM / 2; x <= runwayWidthM / 2; x += runwayWidthM / 8) {
        const endLight = BABYLON.MeshBuilder.CreateSphere(
          `end_${x}`,
          { diameter: 0.8, segments: 8 },
          this.scene,
        )
        endLight.position.set(x, 1, runwayLengthM - 5)
        endLight.material = redMat
        if (this.glowLayer) {
          this.glowLayer.addIncludedOnlyMesh(endLight)
        }
        this.runwayLights.push(endLight)
      }
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
        // ALSF-2: FAA specification for CAT II/III runways (per Figure 2-1)
        
        // 1. Centerline light bars every 100 ft from 100 to 2400 ft
        // Each standard bar is 14 ft long with 5 equally spaced lights
        for (let ft = 100; ft <= 2400; ft += 100) {
          const z = -feetToMeters(ft)
          
          if (ft === 1000) {
            // 1000-foot bar - special 100 ft wide bar (21 lights with closer spacing)
            // Main centerline bar (5 lights)
            for (let i = -2; i <= 2; i++) {
              const x = i * feetToMeters(3) // 3 ft spacing
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf2_1000_center_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
            // Extended portions (8 lights on each side)
            for (let side = -1; side <= 1; side += 2) {
              for (let i = 1; i <= 8; i++) {
                const x = side * (feetToMeters(15) + i * feetToMeters(5))
                const light = BABYLON.MeshBuilder.CreateSphere(
                  `alsf2_1000_ext_${side}_${i}`,
                  { diameter: 0.6, segments: 8 },
                  this.scene,
                )
                light.position.set(x, 2, z)
                light.material = whiteMat
                if (this.glowLayer) {
                  this.glowLayer.addIncludedOnlyMesh(light)
                }
                this.approachLights.push(light)
              }
            }
          } else {
            // Standard 14 ft centerline bar with 5 lights
            for (let i = -2; i <= 2; i++) {
              const x = i * feetToMeters(3.5) // 14 ft / 4 spaces = 3.5 ft
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf2_bar_${ft}_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
          }
        }
        
        // 2. 500-foot bar - 4 white lights extending 30 ft on each side
        const fiveHundredZ = -feetToMeters(500)
        // Left side barrette
        for (let i = 0; i < 4; i++) {
          const x = -feetToMeters(15 + i * 5) // Starting 15 ft from center
          const light = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_500bar_left_${i}`,
            { diameter: 0.6, segments: 8 },
            this.scene,
          )
          light.position.set(x, 2, fiveHundredZ)
          light.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        // Right side barrette
        for (let i = 0; i < 4; i++) {
          const x = feetToMeters(15 + i * 5) // Starting 15 ft from center
          const light = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_500bar_right_${i}`,
            { diameter: 0.6, segments: 8 },
            this.scene,
          )
          light.position.set(x, 2, fiveHundredZ)
          light.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        
        // 3. Red side row bars - 3 red lights on each side for stations 100-900 ft
        // Aligned with touchdown zone lights position
        for (let ft = 100; ft <= 900; ft += 100) {
          const z = -feetToMeters(ft)
          for (let side = -1; side <= 1; side += 2) {
            // 3 lights starting from about 40 ft from centerline
            for (let i = 0; i < 3; i++) {
              const x = side * feetToMeters(40 + i * 5) // 40, 45, 50 ft from centerline
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf2_sidebar_${ft}_${side}_${i}`,
                { diameter: 0.5, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = redMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
          }
        }
        
        // 4. Green threshold bar - continuous row across runway width plus 45 ft on each side
        const greenMat = new BABYLON.StandardMaterial('thresholdGreen', this.scene)
        greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
        greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)
        
        // Threshold bar extends 45 ft beyond each runway edge
        const thresholdBarWidth = runwayWidthM + feetToMeters(90) // 150 ft runway + 90 ft total extension
        const thresholdLightSpacing = feetToMeters(5) // 5 ft centers per spec
        const numThresholdLights = Math.floor(thresholdBarWidth / thresholdLightSpacing)
        
        for (let i = 0; i <= numThresholdLights; i++) {
          const x = -thresholdBarWidth / 2 + i * thresholdLightSpacing
          const light = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_threshold_${i}`,
            { diameter: 0.8, segments: 8 },
            this.scene,
          )
          light.position.set(x, 1, 0) // At runway threshold
          light.material = greenMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        
        // 5. Touchdown zone lights (white barrettes) - similar geometry to red side bars
        // Located at 100 ft intervals from 100-1000 ft on runway
        const tdzStations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
        for (const ft of tdzStations) {
          const z = feetToMeters(ft) // Positive z for runway surface
          for (let side = -1; side <= 1; side += 2) {
            // Create a barrette of 3 lights like the red side bars
            for (let i = 0; i < 3; i++) {
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf2_tdz_${ft}_${side}_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              // Same lateral positioning as red side bars but on the runway
              const x = side * feetToMeters(40 + i * 5) // 40, 45, 50 ft from centerline
              light.position.set(x, 1, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.runwayLights.push(light) // Add to runway lights, not approach lights
            }
          }
        }
        
        // 6. Sequenced flashers - from 1000 ft to end of system (2400 ft)
        // One at each centerline bar position, flashing toward threshold at 2 Hz
        for (let ft = 1000; ft <= 2400; ft += 100) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `alsf2_seq_${ft}`,
            { diameter: 1.5, segments: 8 }, // Bluish-white sequenced flasher
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

        // REILs are handled separately in createRunwayEdgeLights

        this.startRabbitSequence()
        this.createRunwayCenterlineLights() // Add RCLS for ALSF-II
        break
      }

      case 'ALSF-I': {
        // ALSF-1: 3000 ft system for CAT I runways
        // Station 0+00 at threshold, higher numbers into approach
        
        // 1. Centerline barrettes - every 100 ft from station 1+00 to 30+00
        // Each barrette: 5 lights at 40.5 inch (1.03m) spacing
        const barrSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters
        for (let ft = 100; ft <= 3000; ft += 100) {
          const z = -feetToMeters(ft)
          
          if (ft === 1000) {
            // Station 10+00: Special 1000 ft crossbar with centerline barrette
            // Center barrette (5 lights)
            for (let i = -2; i <= 2; i++) {
              const x = i * barrSpacing
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf1_1000_center_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
            
            // Side barrettes - 8 lights each at 5 ft spacing, outermost at 50 ft
            for (let side = -1; side <= 1; side += 2) {
              for (let i = 0; i < 8; i++) {
                const x = side * (feetToMeters(22.5) + i * feetToMeters(5))
                const light = BABYLON.MeshBuilder.CreateSphere(
                  `alsf1_1000_side_${side}_${i}`,
                  { diameter: 0.6, segments: 8 },
                  this.scene,
                )
                light.position.set(x, 2, z)
                light.material = whiteMat
                if (this.glowLayer) {
                  this.glowLayer.addIncludedOnlyMesh(light)
                }
                this.approachLights.push(light)
              }
            }
          } else {
            // Standard centerline barrette - 5 lights at 40.5 inch spacing
            for (let i = -2; i <= 2; i++) {
              const x = i * barrSpacing
              const light = BABYLON.MeshBuilder.CreateSphere(
                `alsf1_bar_${ft}_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
          }
        }
        
        // 2. Pre-threshold bar at station 1+00 (100 ft) - RED
        // Two barrettes, 5 lights each at 3.5 ft centers
        // Innermost lights 75-80 ft from centerline
        const preThresholdZ = -feetToMeters(100)
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 5; i++) {
            const x = side * (feetToMeters(75) + i * feetToMeters(3.5))
            const light = BABYLON.MeshBuilder.CreateSphere(
              `alsf1_prethresh_${side}_${i}`,
              { diameter: 0.6, segments: 8 },
              this.scene,
            )
            light.position.set(x, 2, preThresholdZ)
            light.material = redMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(light)
            }
            this.approachLights.push(light)
          }
        }
        
        // 3. Terminating bar at station 2+00 (200 ft) - RED
        // Two barrettes, 3 lights each at 5 ft centers
        // Outermost lights 25 ft from centerline
        const termZ = -feetToMeters(200)
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 3; i++) {
            const x = side * (feetToMeters(15) + i * feetToMeters(5))
            const light = BABYLON.MeshBuilder.CreateSphere(
              `alsf1_term_${side}_${i}`,
              { diameter: 0.6, segments: 8 },
              this.scene,
            )
            light.position.set(x, 2, termZ)
            light.material = redMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(light)
            }
            this.approachLights.push(light)
          }
        }
        
        // 4. Green threshold bar (same as ALSF-2)
        const greenMat = new BABYLON.StandardMaterial('alsf1ThresholdGreen', this.scene)
        greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
        greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)
        
        const thresholdBarWidth = runwayWidthM + feetToMeters(90)
        const thresholdLightSpacing = feetToMeters(5)
        const numThresholdLights = Math.floor(thresholdBarWidth / thresholdLightSpacing)
        
        for (let i = 0; i <= numThresholdLights; i++) {
          const x = -thresholdBarWidth / 2 + i * thresholdLightSpacing
          const light = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_threshold_${i}`,
            { diameter: 0.8, segments: 8 },
            this.scene,
          )
          light.position.set(x, 1, 0)
          light.material = greenMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        
        // 5. Sequenced flashers - 21 lights from station 10+00 to 30+00
        for (let ft = 1000; ft <= 3000; ft += 100) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `alsf1_seq_${ft}`,
            { diameter: 1.5, segments: 8 },
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

        // REILs are handled separately in createRunwayEdgeLights

        this.startRabbitSequence()
        this.createRunwayCenterlineLights() // Add RCLS for ALSF-I
        break
      }

      case 'MALS': {
        // MALS: Medium-intensity Approach Lighting System (base configuration)
        
        // Create the base MALS components
        this.createMALSBase('mals', whiteMat)
        
        // No sequenced flashers for base MALS
        break
      }
      
      case 'MALSF': {
        // MALSF: MALS with three sequenced flashers at last three stations
        
        // Create the base MALS components
        this.createMALSBase('malsf', whiteMat)
        
        // Add three sequenced flashers at last three stations (1000, 1200, 1400 ft)
        const flasherPositions = [1000, 1200, 1400]
        for (const ft of flasherPositions) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `malsf_seq_${ft}`,
            { diameter: 1.5, segments: 8 },
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
        // MALSR: MALS plus RAIL (for CAT I runways)
        
        // Create the base MALS components
        this.createMALSBase('malsr', whiteMat)
        
        // RAIL sequenced flashers - 5 flashers from 1600 to 2400 ft
        // First flasher is 200 ft beyond MALS end (1400 ft)
        for (let ft = 1600; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `malsr_seq_${ft}`,
            { diameter: 1.5, segments: 8 },
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

      case 'SSALR': {
        // SSALR: Simplified Short Approach Lighting System with RAIL
        // Operated as a subsystem of ALSF-2
        
        // 1. Seven five-light centerline bars from 200 to 1400 ft at 200 ft intervals
        for (let ft = 200; ft <= 1400; ft += 200) {
          const z = -feetToMeters(ft)
          
          if (ft === 1000) {
            // Special 1000 ft crossbar - 70 ft wide total
            // Center bar (5 lights with 40.5 inch spacing)
            const centerSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters
            for (let i = -2; i <= 2; i++) {
              const x = i * centerSpacing
              const light = BABYLON.MeshBuilder.CreateSphere(
                `ssalr_1000_center_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
            
            // Side bars - one on each side, 5 lights each with 5 ft spacing
            for (let side = -1; side <= 1; side += 2) {
              for (let i = 0; i < 5; i++) {
                // Position to create 70 ft total crossbar width
                const x = side * (feetToMeters(15) + i * feetToMeters(5))
                const light = BABYLON.MeshBuilder.CreateSphere(
                  `ssalr_1000_side_${side}_${i}`,
                  { diameter: 0.6, segments: 8 },
                  this.scene,
                )
                light.position.set(x, 2, z)
                light.material = whiteMat
                if (this.glowLayer) {
                  this.glowLayer.addIncludedOnlyMesh(light)
                }
                this.approachLights.push(light)
              }
            }
          } else {
            // Standard centerline bar - 5 lights with 40.5 inch spacing
            const barSpacing = feetToMeters(40.5 / 12) // Convert inches to feet then meters
            for (let i = -2; i <= 2; i++) {
              const x = i * barSpacing
              const light = BABYLON.MeshBuilder.CreateSphere(
                `ssalr_bar_${ft}_${i}`,
                { diameter: 0.6, segments: 8 },
                this.scene,
              )
              light.position.set(x, 2, z)
              light.material = whiteMat
              if (this.glowLayer) {
                this.glowLayer.addIncludedOnlyMesh(light)
              }
              this.approachLights.push(light)
            }
          }
        }
        
        // 2. Green threshold bar - lights on 10 ft centers across runway
        const greenMat = new BABYLON.StandardMaterial('ssalrThresholdGreen', this.scene)
        greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
        greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)
        
        const thresholdSpacing = feetToMeters(10) // 10 ft centers
        const numThresholdLights = Math.floor(runwayWidthM / thresholdSpacing)
        
        for (let i = 0; i <= numThresholdLights; i++) {
          const x = -runwayWidthM / 2 + i * thresholdSpacing
          const light = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_threshold_${i}`,
            { diameter: 0.8, segments: 8 },
            this.scene,
          )
          light.position.set(x, 1, 0) // At runway threshold
          light.material = greenMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        
        // 3. RAIL sequenced flashers - 5 flashers from 1600 to 2400 ft
        // First flasher is 200 ft beyond last steady light (1400 ft), so starts at 1600 ft
        for (let ft = 1600; ft <= 2400; ft += 200) {
          const z = -feetToMeters(ft)
          const flasher = BABYLON.MeshBuilder.CreateSphere(
            `ssalr_seq_${ft}`,
            { diameter: 1.5, segments: 8 },
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

        // REILs are handled separately in createRunwayEdgeLights
        this.startRabbitSequence() // Add sequenced flashing for SSALR
        break
      }
      
      case 'ODALS': {
        // ODALS: Omnidirectional Approach Lighting System
        // 7 omnidirectional flashing lights for nonprecision runways
        
        // 1. Five lights on runway centerline extended (300-1500 ft at 300 ft intervals)
        for (let ft = 300; ft <= 1500; ft += 300) {
          const z = -feetToMeters(ft)
          const odal = BABYLON.MeshBuilder.CreateSphere(
            `odals_center_${ft}`,
            { diameter: 2, segments: 8 }, // Omnidirectional flasher
            this.scene,
          )
          odal.position.set(0, 3, z)
          odal.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(odal)
          }
          this.sequencedFlashers.push(odal)
          this.approachLights.push(odal)
        }
        
        // 2. Two lights on each side of threshold
        // 40 ft from runway edge (or 75 ft when VASI equipped)
        const lateralDistance = this.approachStore.showPAPI ? feetToMeters(75) : feetToMeters(40)
        const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
        
        for (let side = -1; side <= 1; side += 2) {
          const odal = BABYLON.MeshBuilder.CreateSphere(
            `odals_threshold_${side}`,
            { diameter: 2, segments: 8 },
            this.scene,
          )
          // Position from runway edge, not centerline
          const x = side * (runwayWidthM / 2 + lateralDistance)
          odal.position.set(x, 3, 0) // At threshold
          odal.material = strobeMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(odal)
          }
          this.sequencedFlashers.push(odal)
          this.approachLights.push(odal)
        }
        
        // All ODALS lights flash in sequence
        this.startRabbitSequence()
        break
      }
      
      case 'None': {
        // No approach lighting
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
    // Recreate runway markings to reflect new settings
    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    
    // Clear ALL existing markings - be aggressive to prevent duplicates
    const meshesToDispose: string[] = []
    const meshesToRemove: BABYLON.Mesh[] = []
    
    this.scene.meshes.forEach((mesh) => {
      // Check if this is ANY marking we should dispose
      if (mesh.name.match(/^(threshold|zero|nine|centerline|edgeStripe|aimingPoint|tdz_)/)) {
        meshesToDispose.push(mesh.name)
        meshesToRemove.push(mesh as BABYLON.Mesh)
      }
    })
    
    // Dispose them all
    meshesToRemove.forEach(mesh => {
      mesh.dispose()
    })
    
    
    // Recreate markings with new settings
    this.createRunwayMarkings(runwayLengthM, runwayWidthM)
    
    // Update lighting
    this.updateLighting()
    this.setupWeatherEffects()
    if (!this.animationStore.isPlaying) {
      this.resetCameraPosition()
    }
  }

  private createRunwayCenterlineLights(): void {
    if (!this.approachStore.showRCLS) return

    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const whiteMat = new BABYLON.StandardMaterial('rclsWhite', this.scene)
    whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    const redMat = new BABYLON.StandardMaterial('rclsRed', this.scene)
    redMat.emissiveColor = new BABYLON.Color3(1, 0, 0)
    redMat.diffuseColor = new BABYLON.Color3(1, 0, 0)

    const alternateMat = new BABYLON.StandardMaterial('rclsAlternate', this.scene)
    alternateMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95)
    alternateMat.diffuseColor = new BABYLON.Color3(1, 1, 1)

    // RCLS lights are spaced at 50 ft intervals along the centerline
    const spacingFt = 50
    const spacingM = feetToMeters(spacingFt)
    
    // Last 3000 ft: alternating red/white
    // Next 1000 ft: all white
    // Remaining: white
    const last3000ftM = feetToMeters(3000)
    const last1000ftM = feetToMeters(1000)
    
    for (let i = 0; i * spacingM <= runwayLengthM; i++) {
      const z = i * spacingM
      const distanceFromEnd = runwayLengthM - z
      
      let material = whiteMat
      
      if (distanceFromEnd <= last1000ftM) {
        // Last 1000 ft: alternating red/white
        material = i % 2 === 0 ? redMat : alternateMat
      } else if (distanceFromEnd <= last3000ftM) {
        // Last 3000 ft (but not the final 1000): all white
        material = whiteMat
      }
      
      const light = BABYLON.MeshBuilder.CreateSphere(
        `rcls_${i}`,
        { diameter: 0.3, segments: 6 },
        this.scene,
      )
      light.position.set(0, 0.1, z) // Embedded in runway surface
      light.material = material
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }
      this.runwayLights.push(light)
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

  private createREILLights(): void {
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    
    const strobeMat = new BABYLON.StandardMaterial('reilStrobe', this.scene)
    strobeMat.emissiveColor = new BABYLON.Color3(1, 1, 1)
    strobeMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
    
    for (let side = -1; side <= 1; side += 2) {
      const reil = BABYLON.MeshBuilder.CreateSphere(
        `reil_standalone_${side}`,
        { diameter: 2, segments: 8 },
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

  private createMALSBase(prefix: string, whiteMat: BABYLON.StandardMaterial): void {
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    
    // 1. Seven five-light centerline bars from 200 to 1400 ft at 200 ft intervals
    const barSpacing = feetToMeters(2.5) // 2.5 ft spacing between lights
    for (let ft = 200; ft <= 1400; ft += 200) {
      const z = -feetToMeters(ft)
      
      if (ft === 1000) {
        // Special 1000 ft crossbar - 66 ft wide total
        // Center bar (5 lights)
        for (let i = -2; i <= 2; i++) {
          const x = i * barSpacing
          const light = BABYLON.MeshBuilder.CreateSphere(
            `${prefix}_1000_center_${i}`,
            { diameter: 0.6, segments: 8 },
            this.scene,
          )
          light.position.set(x, 2, z)
          light.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
        
        // Side bars - one on each side (5 lights each, 2.5 ft spacing)
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 5; i++) {
            // Position to create 66 ft total crossbar width
            const x = side * (feetToMeters(13) + i * barSpacing)
            const light = BABYLON.MeshBuilder.CreateSphere(
              `${prefix}_1000_side_${side}_${i}`,
              { diameter: 0.6, segments: 8 },
              this.scene,
            )
            light.position.set(x, 2, z)
            light.material = whiteMat
            if (this.glowLayer) {
              this.glowLayer.addIncludedOnlyMesh(light)
            }
            this.approachLights.push(light)
          }
        }
      } else {
        // Standard centerline bar - 5 lights with 2.5 ft spacing
        for (let i = -2; i <= 2; i++) {
          const x = i * barSpacing
          const light = BABYLON.MeshBuilder.CreateSphere(
            `${prefix}_bar_${ft}_${i}`,
            { diameter: 0.6, segments: 8 },
            this.scene,
          )
          light.position.set(x, 2, z)
          light.material = whiteMat
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(light)
          }
          this.approachLights.push(light)
        }
      }
    }
    
    // 2. Green threshold bar - lights on 10 ft centers across runway
    const greenMat = new BABYLON.StandardMaterial(`${prefix}ThresholdGreen`, this.scene)
    greenMat.emissiveColor = new BABYLON.Color3(0, 1, 0)
    greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0)
    
    const thresholdSpacing = feetToMeters(10)
    const numThresholdLights = Math.floor(runwayWidthM / thresholdSpacing)
    
    for (let i = 0; i <= numThresholdLights; i++) {
      const x = -runwayWidthM / 2 + i * thresholdSpacing
      const light = BABYLON.MeshBuilder.CreateSphere(
        `${prefix}_threshold_${i}`,
        { diameter: 0.8, segments: 8 },
        this.scene,
      )
      light.position.set(x, 1, 0)
      light.material = greenMat
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(light)
      }
      this.approachLights.push(light)
    }
    // REILs are handled separately in createRunwayEdgeLights
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
    
    // For 2 Hz (2 complete sequences per second), each sequence takes 500ms
    // With n lights, each light should be visible for 500ms/n
    const sequenceTime = 500 // milliseconds for complete sequence
    const timePerLight = Math.floor(sequenceTime / Math.max(1, this.sequencedFlashers.length))

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
    }, timePerLight) as unknown as number
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
