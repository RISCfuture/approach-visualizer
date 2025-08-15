import * as BABYLON from 'babylonjs'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import {
  feetToMeters,
  statuteMilesToMeters,
  TOUCHDOWN_ZONE_DISTANCE_FT,
  FEET_PER_NM,
  RUNWAY_LENGTH_FT,
  RUNWAY_WIDTH_FT,
} from '@/types/approach'

// Import the new modular systems
import { LightingManager } from './lighting/LightingManager'

/**
 * Refactored SceneManager using the new modular architecture
 * Reduced from ~2000 lines to ~600 lines with better organization
 */
export class SceneManager {
  private engine: BABYLON.Engine
  private scene: BABYLON.Scene
  private camera: BABYLON.UniversalCamera
  private canvas: HTMLCanvasElement
  private approachStore: ReturnType<typeof useApproachStore>
  private animationStore: ReturnType<typeof useAnimationStore>

  // Modular subsystem - Lighting
  private lightingManager: LightingManager

  // Weather effects (keeping inline for now as it's already partially modular)
  private fogPostProcess: BABYLON.PostProcess | null = null
  private cloudParticles: BABYLON.ParticleSystem | null = null
  private cloudTransitionTime: number = 0
  private lastAltitudeInClouds: boolean = false

  // Animation state
  private lastFrameTime: number = 0
  private isDarkMode: boolean = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.engine = new BABYLON.Engine(canvas, true)
    this.scene = new BABYLON.Scene(this.engine)
    this.approachStore = useApproachStore()
    this.animationStore = useAnimationStore()

    // Setup camera
    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, 0), this.scene)
    this.camera.attachControl(canvas, false)
    this.camera.inputs.clear()
    this.camera.fov = 0.8

    // Check dark mode
    this.checkDarkMode()

    // Initialize lighting manager
    this.lightingManager = new LightingManager(this.scene)

    // Setup scene
    this.setupScene()

    // Create runway and ground
    this.createRunway()
    this.createGround()

    // Setup lighting
    this.updateLighting()

    // Setup weather
    this.setupWeatherEffects()

    // Reset camera
    this.resetCameraPosition()

    // Listen for dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.isDarkMode = e.matches
      this.updateSceneForDarkMode()
    })

    // Start render loop
    this.engine.runRenderLoop(() => {
      this.update()
      this.scene.render()
    })

    // Handle resize
    window.addEventListener('resize', () => {
      this.engine.resize()
    })
  }

  private setupScene(): void {
    // Clear existing lights
    this.scene.lights.forEach((light) => light.dispose())

    // Set scene colors based on dark mode
    if (this.isDarkMode) {
      this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1)
      this.scene.fogColor = new BABYLON.Color3(0.06, 0.06, 0.14)
    } else {
      this.scene.clearColor = new BABYLON.Color4(0.6, 0.75, 0.9, 1)
      this.scene.fogColor = new BABYLON.Color3(0.7, 0.75, 0.8)
    }

    // Basic fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR
    this.updateFogDistance()

    // Ambient lighting
    const ambientLight = new BABYLON.HemisphericLight(
      'ambient',
      new BABYLON.Vector3(0, 1, 0),
      this.scene,
    )
    ambientLight.intensity = this.isDarkMode ? 0.08 : 0.6
    ambientLight.groundColor = this.isDarkMode
      ? new BABYLON.Color3(0.02, 0.02, 0.04)
      : new BABYLON.Color3(0.3, 0.3, 0.35)

    // Directional light (sun/moon)
    const directionalLight = new BABYLON.DirectionalLight(
      'sun',
      new BABYLON.Vector3(-0.3, -0.7, 0.5),
      this.scene,
    )
    directionalLight.intensity = this.isDarkMode ? 0.05 : 0.5
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
    runway.position.y = 0
    runway.position.z = runwayLengthM / 2

    const runwayMat = new BABYLON.StandardMaterial('runwayMat', this.scene)
    runwayMat.diffuseColor = this.isDarkMode
      ? new BABYLON.Color3(0.15, 0.15, 0.17)
      : new BABYLON.Color3(0.3, 0.3, 0.3)
    runwayMat.specularColor = this.isDarkMode
      ? new BABYLON.Color3(0.02, 0.02, 0.03)
      : new BABYLON.Color3(0.1, 0.1, 0.1)
    runway.material = runwayMat

    this.createRunwayMarkings(runwayLengthM, runwayWidthM)
  }

  private createGround(): void {
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      {
        width: 10000,
        height: 20000,
      },
      this.scene,
    )
    ground.position.y = -1
    ground.position.z = 0

    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene)
    groundMat.diffuseColor = this.isDarkMode
      ? new BABYLON.Color3(0.03, 0.04, 0.03)
      : new BABYLON.Color3(0.1, 0.2, 0.1)
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
    if (this.isDarkMode) {
      groundMat.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.01)
    }
    ground.material = groundMat
  }

  private createRunwayMarkings(length: number, width: number): void {
    const markingMat = new BABYLON.StandardMaterial('markingMat', this.scene)
    markingMat.diffuseColor = new BABYLON.Color3(1, 1, 1)
    markingMat.emissiveColor = this.isDarkMode
      ? new BABYLON.Color3(0.15, 0.15, 0.15)
      : new BABYLON.Color3(0.8, 0.8, 0.8)

    // Centerline - Always visible
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

    // Runway numbers
    this.createRunwayNumbers(length, markingMat)

    // Threshold markings
    if (this.approachStore.showThresholdMarkings) {
      this.createThresholdMarkings(width, markingMat)
    }

    // Side stripes
    if (this.approachStore.showSideStripes) {
      this.createSideStripes(length, width, markingMat)
    }

    // Aiming point markings
    if (this.approachStore.showAimPoint) {
      this.createAimingPointMarkings(markingMat)
    }

    // Touchdown zone markings
    if (this.approachStore.showTouchdownZone) {
      this.createTouchdownZoneMarkings(markingMat)
    }
  }

  private createRunwayNumbers(length: number, material: BABYLON.StandardMaterial): void {
    const numberHeight = feetToMeters(60)
    const numberWidth = feetToMeters(20)
    const strokeWidth = feetToMeters(5)
    const baseZ = feetToMeters(200)

    // Create "0" and "9" for runway 09
    // "0" (left side)
    const zero1 = BABYLON.MeshBuilder.CreateBox(
      'zero1',
      { width: numberWidth, height: 0.05, depth: strokeWidth },
      this.scene,
    )
    zero1.position.set(-feetToMeters(30), 0.2, baseZ)
    zero1.material = material

    const zero2 = BABYLON.MeshBuilder.CreateBox(
      'zero2',
      { width: strokeWidth, height: 0.05, depth: numberHeight - strokeWidth },
      this.scene,
    )
    zero2.position.set(
      -feetToMeters(30) - numberWidth / 2 + strokeWidth / 2,
      0.2,
      baseZ + numberHeight / 2,
    )
    zero2.material = material

    const zero3 = BABYLON.MeshBuilder.CreateBox(
      'zero3',
      { width: strokeWidth, height: 0.05, depth: numberHeight - strokeWidth },
      this.scene,
    )
    zero3.position.set(
      -feetToMeters(30) + numberWidth / 2 - strokeWidth / 2,
      0.2,
      baseZ + numberHeight / 2,
    )
    zero3.material = material

    const zero4 = BABYLON.MeshBuilder.CreateBox(
      'zero4',
      { width: numberWidth, height: 0.05, depth: strokeWidth },
      this.scene,
    )
    zero4.position.set(-feetToMeters(30), 0.2, baseZ + numberHeight - strokeWidth)
    zero4.material = material

    // "9" (right side)
    const nine1 = BABYLON.MeshBuilder.CreateBox(
      'nine1',
      { width: numberWidth, height: 0.05, depth: strokeWidth },
      this.scene,
    )
    nine1.position.set(feetToMeters(30), 0.2, baseZ)
    nine1.material = material

    const nine2 = BABYLON.MeshBuilder.CreateBox(
      'nine2',
      { width: strokeWidth, height: 0.05, depth: numberHeight / 2 },
      this.scene,
    )
    nine2.position.set(
      feetToMeters(30) - numberWidth / 2 + strokeWidth / 2,
      0.2,
      baseZ + numberHeight / 4,
    )
    nine2.material = material

    const nine3 = BABYLON.MeshBuilder.CreateBox(
      'nine3',
      { width: numberWidth, height: 0.05, depth: strokeWidth },
      this.scene,
    )
    nine3.position.set(feetToMeters(30), 0.2, baseZ + numberHeight / 2)
    nine3.material = material

    const nine4 = BABYLON.MeshBuilder.CreateBox(
      'nine4',
      { width: strokeWidth, height: 0.05, depth: numberHeight / 2 },
      this.scene,
    )
    nine4.position.set(
      feetToMeters(30) + numberWidth / 2 - strokeWidth / 2,
      0.2,
      baseZ + (3 * numberHeight) / 4,
    )
    nine4.material = material

    const nine5 = BABYLON.MeshBuilder.CreateBox(
      'nine5',
      { width: numberWidth, height: 0.05, depth: strokeWidth },
      this.scene,
    )
    nine5.position.set(feetToMeters(30), 0.2, baseZ + numberHeight - strokeWidth)
    nine5.material = material
  }

  private createThresholdMarkings(width: number, material: BABYLON.StandardMaterial): void {
    const thresholdStripeWidth = feetToMeters(5.75)
    const thresholdStripeLength = feetToMeters(150)
    const thresholdSpacing = feetToMeters(5.75)
    const thresholdStartZ = 0

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
        threshold.material = material
      }
    }
  }

  private createSideStripes(
    length: number,
    width: number,
    material: BABYLON.StandardMaterial,
  ): void {
    const edgeStripeWidth = feetToMeters(3)

    for (let side = -1; side <= 1; side += 2) {
      const edgeStripe = BABYLON.MeshBuilder.CreateBox(
        `edgeStripe_${side}`,
        {
          width: edgeStripeWidth,
          height: 0.05,
          depth: length * 0.9,
        },
        this.scene,
      )
      edgeStripe.position.x = side * (width / 2 - edgeStripeWidth / 2 - feetToMeters(2))
      edgeStripe.position.z = length * 0.45
      edgeStripe.position.y = 0.2
      edgeStripe.material = material
    }
  }

  private createAimingPointMarkings(material: BABYLON.StandardMaterial): void {
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
      aimingPoint.position.x = side * feetToMeters(35)
      aimingPoint.position.y = 0.2
      aimingPoint.material = material
    }
  }

  private createTouchdownZoneMarkings(material: BABYLON.StandardMaterial): void {
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
          tdz.material = material
        }
      }
    }
  }

  private updateLighting(): void {
    // Delegate to LightingManager
    this.lightingManager.updateLighting({
      lightingType: this.approachStore.lightingType,
      showEdgeLights: this.approachStore.showEdgeLights,
      showPAPI: this.approachStore.showPAPI,
      showREIL: this.approachStore.showREIL,
      showRCLS: this.approachStore.showRCLS,
    })
  }

  private setupWeatherEffects(): void {
    this.updateFogDistance()
    this.setupSimpleCloudEffect()
    this.setupCloudParticles()
  }

  private setupCloudParticles(): void {
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
      this.cloudParticles = null
    }

    const particleSystem = new BABYLON.ParticleSystem('cloudParticles', 500, this.scene)
    particleSystem.disposeOnStop = false

    const cloudTexture = new BABYLON.DynamicTexture('cloudTexture', 256, this.scene, false)
    const ctx = cloudTexture.getContext()

    ctx.clearRect(0, 0, 256, 256)

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 120)
    gradient.addColorStop(0, 'rgba(240, 240, 240, 0.6)')
    gradient.addColorStop(0.2, 'rgba(230, 230, 230, 0.4)')
    gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.2)')
    gradient.addColorStop(0.8, 'rgba(210, 210, 210, 0.05)')
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)

    for (let i = 0; i < 3; i++) {
      const x = 128 + (Math.random() - 0.5) * 80
      const y = 128 + (Math.random() - 0.5) * 80
      const radius = Math.random() * 60 + 40
      const softGradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius)
      softGradient.addColorStop(0, 'rgba(235, 235, 235, 0.1)')
      softGradient.addColorStop(0.7, 'rgba(225, 225, 225, 0.05)')
      softGradient.addColorStop(1, 'rgba(215, 215, 215, 0)')
      ctx.fillStyle = softGradient
      ctx.fillRect(0, 0, 256, 256)
    }

    cloudTexture.update()
    particleSystem.particleTexture = cloudTexture

    const emitterBox = BABYLON.MeshBuilder.CreateBox('cloudEmitter', { size: 1 }, this.scene)
    emitterBox.isVisible = false
    emitterBox.parent = this.camera
    emitterBox.position = new BABYLON.Vector3(0, 0, 20)

    particleSystem.emitter = emitterBox
    particleSystem.minEmitBox = new BABYLON.Vector3(-100, -30, -50)
    particleSystem.maxEmitBox = new BABYLON.Vector3(100, 30, 50)

    if (this.isDarkMode) {
      particleSystem.color1 = new BABYLON.Color4(0.95, 0.95, 0.95, 0.4)
      particleSystem.color2 = new BABYLON.Color4(0.9, 0.9, 0.9, 0.2)
      particleSystem.colorDead = new BABYLON.Color4(0.9, 0.9, 0.9, 0)
    } else {
      particleSystem.color1 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.5)
      particleSystem.color2 = new BABYLON.Color4(0.65, 0.65, 0.65, 0.3)
      particleSystem.colorDead = new BABYLON.Color4(0.7, 0.7, 0.7, 0)
    }

    particleSystem.minSize = 20
    particleSystem.maxSize = 40
    particleSystem.minLifeTime = 3
    particleSystem.maxLifeTime = 5
    particleSystem.emitRate = 50

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
    const updateCloudFog = () => {
      const altitude = this.animationStore.currentAltitude
      const ceiling = this.approachStore.effectiveCeiling
      const currentlyInClouds = altitude > ceiling

      if (currentlyInClouds !== this.lastAltitudeInClouds) {
        this.cloudTransitionTime = Date.now()
        this.lastAltitudeInClouds = currentlyInClouds
      }

      const transitionDuration = 500
      const timeSinceTransition = Date.now() - this.cloudTransitionTime
      const transitionProgress = Math.min(1, timeSinceTransition / transitionDuration)

      // Update glow layer intensity based on altitude
      const glowLayer = this.lightingManager['glowLayer']
      if (glowLayer) {
        const baseIntensity = this.isDarkMode ? 2.5 : 1.2

        if (altitude > ceiling + 50) {
          glowLayer.intensity = 0
        } else if (altitude > ceiling) {
          const transitionFactor = 1 - (altitude - ceiling) / 50
          glowLayer.intensity = baseIntensity * (0.2 + 0.6 * transitionFactor)
        } else if (altitude > ceiling - 50) {
          const breakoutFactor = (ceiling - altitude) / 50
          glowLayer.intensity = baseIntensity * (0.8 + 0.2 * breakoutFactor)
        } else {
          glowLayer.intensity = baseIntensity
        }
      }

      if (altitude > ceiling + 50) {
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2
        this.scene.fogDensity = 1.0
        if (this.isDarkMode) {
          this.scene.fogColor = new BABYLON.Color3(0.5, 0.5, 0.5)
          this.scene.clearColor = new BABYLON.Color4(0.5, 0.5, 0.5, 1)
        } else {
          this.scene.fogColor = new BABYLON.Color3(0.75, 0.75, 0.75)
          this.scene.clearColor = new BABYLON.Color4(0.75, 0.75, 0.75, 1)
        }

        if (
          this.cloudParticles &&
          !this.cloudParticles.isStarted() &&
          this.animationStore.isPlaying &&
          !this.animationStore.isPaused
        ) {
          this.cloudParticles.start()
        }
      } else if (altitude > ceiling) {
        const altitudeTransition = (altitude - ceiling) / 50
        const smoothTransition = altitudeTransition * transitionProgress

        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2
        this.scene.fogDensity = 0.2 + 0.8 * smoothTransition

        if (this.isDarkMode) {
          const intensity = 0.3 + 0.4 * smoothTransition
          this.scene.fogColor = new BABYLON.Color3(intensity, intensity, intensity)
          this.scene.clearColor = new BABYLON.Color4(intensity, intensity, intensity, 1)
        } else {
          const r = 0.55 + 0.2 * smoothTransition
          const g = 0.57 + 0.18 * smoothTransition
          const b = 0.6 + 0.15 * smoothTransition
          this.scene.fogColor = new BABYLON.Color3(r, g, b)
          this.scene.clearColor = new BABYLON.Color4(r, g, b, 1)
        }

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
        this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR

        if (this.isDarkMode) {
          this.scene.fogColor = new BABYLON.Color3(0.06, 0.06, 0.14)
          this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1)
        } else {
          this.scene.fogColor = new BABYLON.Color3(0.55, 0.57, 0.6)
          this.scene.clearColor = new BABYLON.Color4(0.5, 0.52, 0.55, 1)
        }

        this.updateFogDistance()

        if (this.cloudParticles && this.cloudParticles.isStarted()) {
          this.cloudParticles.stop()
        }
      }
    }

    this.scene.registerBeforeRender(updateCloudFog)
  }

  private updateFogDistance(): void {
    let visibilityMeters: number
    if (this.approachStore.visibilityUnit === 'RVR') {
      visibilityMeters = this.approachStore.effectiveVisibility * 0.3048
    } else {
      visibilityMeters = statuteMilesToMeters(this.approachStore.effectiveVisibility)
    }

    if (this.approachStore.visibilityUnit === 'RVR') {
      this.scene.fogStart = visibilityMeters * 0.1
      this.scene.fogEnd = visibilityMeters * 0.8
      this.scene.fogDensity = 0.01
    } else {
      this.scene.fogStart = visibilityMeters * 0.3
      this.scene.fogEnd = visibilityMeters * 1.0
      this.scene.fogDensity = 0.005
    }
  }

  private resetCameraPosition(): void {
    const distanceNm = this.animationStore.startingDistanceNm
    const altitudeMeters = feetToMeters(this.animationStore.currentAltitude)
    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)

    const distanceToTDZ = Math.max(0, distanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM)
    const distanceToTDZMeters = distanceToTDZ * FEET_PER_NM * 0.3048

    this.camera.position = new BABYLON.Vector3(0, altitudeMeters, tdzMeters - distanceToTDZMeters)
    this.camera.setTarget(new BABYLON.Vector3(0, 0, tdzMeters))
  }

  private updateCameraPosition(): void {
    const distanceNm = this.animationStore.currentDistanceNm
    const altitudeMeters = feetToMeters(this.animationStore.currentAltitude)
    const tdzMeters = feetToMeters(TOUCHDOWN_ZONE_DISTANCE_FT)

    const distanceToTDZ = Math.max(0, distanceNm - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM)
    const distanceToTDZMeters = distanceToTDZ * FEET_PER_NM * 0.3048

    this.camera.position.z = tdzMeters - distanceToTDZMeters
    this.camera.position.y = altitudeMeters

    const isNonPrecision =
      this.approachStore.selectedMinimumId === 'non-precision' ||
      this.approachStore.selectedMinimumId === 'circling'

    if (isNonPrecision) {
      const ceiling = this.approachStore.effectiveCeiling
      const angleRadians = (3 * Math.PI) / 180
      const glidepathAltitude = distanceToTDZ * FEET_PER_NM * Math.tan(angleRadians)

      if (this.animationStore.currentAltitude <= ceiling && glidepathAltitude < ceiling) {
        this.camera.setTarget(new BABYLON.Vector3(0, altitudeMeters, tdzMeters + 1000))
      } else {
        this.camera.setTarget(new BABYLON.Vector3(0, 0, tdzMeters))
      }
    } else {
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

      // Update PAPI lights
      this.lightingManager.updatePAPILights(
        this.animationStore.currentAltitude,
        this.animationStore.currentDistanceNm,
      )
    } else {
      this.updateCameraPosition()
      this.lightingManager.updatePAPILights(
        this.animationStore.currentAltitude,
        this.animationStore.currentDistanceNm,
      )
    }

    if (this.animationStore.isPaused) {
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
    // Clear existing markings
    const meshesToRemove: BABYLON.Mesh[] = []

    this.scene.meshes.forEach((mesh) => {
      if (mesh.name.match(/^(threshold|zero|nine|centerline|edgeStripe|aimingPoint|tdz_)/)) {
        meshesToRemove.push(mesh as BABYLON.Mesh)
      }
    })

    meshesToRemove.forEach((mesh) => {
      mesh.dispose()
    })

    // Recreate markings
    const runwayLengthM = feetToMeters(RUNWAY_LENGTH_FT)
    const runwayWidthM = feetToMeters(RUNWAY_WIDTH_FT)
    this.createRunwayMarkings(runwayLengthM, runwayWidthM)

    // Update lighting
    this.updateLighting()
    this.setupWeatherEffects()

    if (!this.animationStore.isPlaying) {
      this.resetCameraPosition()
    }
  }

  private checkDarkMode(): void {
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  private updateSceneForDarkMode(): void {
    this.setupScene()

    // Update lighting manager for dark mode
    this.lightingManager.updateForDarkMode(this.isDarkMode)

    // Update ground material
    const ground = this.scene.getMeshByName('ground')
    if (ground && ground.material) {
      const mat = ground.material as BABYLON.StandardMaterial
      mat.diffuseColor = this.isDarkMode
        ? new BABYLON.Color3(0.03, 0.04, 0.03)
        : new BABYLON.Color3(0.1, 0.2, 0.1)
      mat.emissiveColor = this.isDarkMode
        ? new BABYLON.Color3(0.01, 0.01, 0.01)
        : new BABYLON.Color3(0, 0, 0)
    }

    // Update runway material
    const runway = this.scene.getMeshByName('runway')
    if (runway && runway.material) {
      const mat = runway.material as BABYLON.StandardMaterial
      mat.diffuseColor = this.isDarkMode
        ? new BABYLON.Color3(0.15, 0.15, 0.17)
        : new BABYLON.Color3(0.3, 0.3, 0.3)
      mat.specularColor = this.isDarkMode
        ? new BABYLON.Color3(0.02, 0.02, 0.03)
        : new BABYLON.Color3(0.1, 0.1, 0.1)
    }
  }

  public dispose(): void {
    if (this.fogPostProcess) {
      this.fogPostProcess.dispose()
    }
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
    }
    this.lightingManager.dispose()
    this.engine.dispose()
  }
}
