import * as BABYLON from 'babylonjs'
import { statuteMilesToMeters, rvrToStatuteMiles } from '@/types/approach'

export class WeatherEffects {
  private scene: BABYLON.Scene
  private camera: BABYLON.Camera
  private fogPostProcess: BABYLON.PostProcess | null = null
  private cloudParticles: BABYLON.ParticleSystem | null = null
  private cloudTransitionTime: number = 0
  private lastAltitudeInClouds: boolean = false

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera) {
    this.scene = scene
    this.camera = camera
  }

  setupWeatherEffects(): void {
    this.setupCloudParticles()
    this.setupSimpleCloudEffect()
  }

  private setupCloudParticles(): void {
    // Cleanup existing particles
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
      this.cloudParticles = null
    }

    // Create particle system for cloud wisps
    const particleSystem = new BABYLON.ParticleSystem('clouds', 100, this.scene)

    // Use a simple white texture or create procedural particles
    const cloudTexture = new BABYLON.Texture('', this.scene)
    particleSystem.particleTexture = cloudTexture

    // Emit from around the camera
    particleSystem.emitter = this.camera.position
    particleSystem.minEmitBox = new BABYLON.Vector3(-50, -10, -50)
    particleSystem.maxEmitBox = new BABYLON.Vector3(50, 10, 50)

    // Particle properties
    particleSystem.color1 = new BABYLON.Color4(0.9, 0.9, 0.9, 0.05)
    particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 0.02)
    particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 0)

    particleSystem.minSize = 15
    particleSystem.maxSize = 25

    particleSystem.minLifeTime = 2
    particleSystem.maxLifeTime = 4

    particleSystem.emitRate = 20

    // Movement
    particleSystem.direction1 = new BABYLON.Vector3(-1, 0, 0.5)
    particleSystem.direction2 = new BABYLON.Vector3(1, 0.2, -0.5)
    particleSystem.minEmitPower = 0.5
    particleSystem.maxEmitPower = 1.5

    particleSystem.updateSpeed = 0.01

    // Start disabled
    this.cloudParticles = particleSystem
    this.cloudParticles.stop()
  }

  private setupSimpleCloudEffect(): void {
    if (this.fogPostProcess) {
      this.fogPostProcess.dispose()
      this.fogPostProcess = null
    }

    // Create custom fog post-process for cloud effect
    const postProcess = new BABYLON.PostProcess(
      'cloudFog',
      'cloudFog',
      ['intensity', 'transitionProgress'],
      null,
      1.0,
      this.camera,
      BABYLON.Texture.BILINEAR_SAMPLINGMODE,
      this.scene.getEngine(),
      false,
      `
        precision highp float;
        
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float intensity;
        uniform float transitionProgress;
        
        void main(void) {
            vec4 color = texture2D(textureSampler, vUV);
            
            // Create gradient fog (denser at center and edges for more visible cloud effect)
            float centerDist = length(vUV - vec2(0.5, 0.5));
            float fogFactor = 1.0 - centerDist * 0.4;
            fogFactor = max(fogFactor, 0.6); // Ensure minimum visibility
            fogFactor = fogFactor * intensity;
            
            // Cloud color (darker gray for better visibility)
            vec3 cloudColor = vec3(0.75, 0.75, 0.75);
            
            // Apply transition (fade in/out of clouds)
            fogFactor = fogFactor * transitionProgress;
            
            // Mix with scene
            vec3 finalColor = mix(color.rgb, cloudColor, fogFactor);
            
            // Add more pronounced noise/variation for cloud texture
            float noise1 = sin(vUV.x * 30.0 + vUV.y * 20.0) * 0.03;
            float noise2 = cos(vUV.x * 45.0 - vUV.y * 35.0) * 0.02;
            float noise3 = sin(vUV.x * 60.0) * cos(vUV.y * 40.0) * 0.025;
            finalColor += (noise1 + noise2 + noise3) * fogFactor;
            
            gl_FragColor = vec4(finalColor, color.a);
        }
      `,
    )

    postProcess.onApply = (effect) => {
      effect.setFloat('intensity', 0)
      effect.setFloat('transitionProgress', 0)
    }

    this.fogPostProcess = postProcess
  }

  updateFogDistance(visibility: number, visibilityUnit: 'RVR' | 'SM', isDarkMode: boolean): void {
    // Convert visibility to meters
    let visibilityMeters: number
    if (visibilityUnit === 'SM') {
      visibilityMeters = statuteMilesToMeters(visibility)
    } else {
      // RVR is in feet, convert to statute miles then to meters
      const visibilitySM = rvrToStatuteMiles(visibility)
      visibilityMeters = statuteMilesToMeters(visibilitySM)
    }

    // Set fog based on visibility
    // For low visibility, make fog much closer
    if (visibilityMeters < 500) {
      this.scene.fogStart = 10
      this.scene.fogEnd = Math.max(100, visibilityMeters)
    } else if (visibilityMeters < 1000) {
      this.scene.fogStart = 50
      this.scene.fogEnd = visibilityMeters
    } else {
      this.scene.fogStart = 200
      this.scene.fogEnd = Math.min(5000, visibilityMeters * 2)
    }

    // Adjust fog density for dark mode
    const fogDensity = isDarkMode ? 0.01 : 0.008
    this.scene.fogDensity = fogDensity * (1000 / visibilityMeters)
  }

  updateCloudEffect(
    currentAltitude: number,
    effectiveCeiling: number,
    deltaTime: number,
    isDarkMode: boolean = false,
  ): void {
    if (!this.fogPostProcess) return

    const inClouds =
      currentAltitude >= effectiveCeiling * 0.95 && currentAltitude <= effectiveCeiling * 1.02
    const underClouds = currentAltitude < effectiveCeiling * 0.95

    // Handle transition timing
    if (inClouds !== this.lastAltitudeInClouds) {
      this.cloudTransitionTime = 0
    }
    this.lastAltitudeInClouds = inClouds

    // Smooth transition
    this.cloudTransitionTime += deltaTime
    const transitionDuration = 0.5 // seconds
    const transitionProgress = Math.min(this.cloudTransitionTime / transitionDuration, 1)

    // Update fog intensity
    this.fogPostProcess.onApply = (effect) => {
      const targetIntensity = inClouds ? 0.9 : 0 // Increased from 0.7 to 0.9 for better visibility
      const currentIntensity = inClouds ? transitionProgress : 1 - transitionProgress
      effect.setFloat('intensity', targetIntensity)
      effect.setFloat('transitionProgress', currentIntensity)
    }

    // Update particle visibility with increased opacity for day mode
    if (this.cloudParticles) {
      if (inClouds && !this.cloudParticles.isStarted()) {
        // Increase particle opacity in day mode
        if (!isDarkMode) {
          this.cloudParticles.color1 = new BABYLON.Color4(0.7, 0.7, 0.7, 0.15) // More opaque in day
          this.cloudParticles.color2 = new BABYLON.Color4(0.8, 0.8, 0.8, 0.08)
        } else {
          this.cloudParticles.color1 = new BABYLON.Color4(0.9, 0.9, 0.9, 0.05)
          this.cloudParticles.color2 = new BABYLON.Color4(1, 1, 1, 0.02)
        }
        this.cloudParticles.start()
      } else if (!inClouds && this.cloudParticles.isStarted()) {
        this.cloudParticles.stop()
      }
    }

    // Update scene colors based on position relative to clouds
    if (underClouds && !isDarkMode) {
      // Gray sky when under clouds in day mode
      this.scene.clearColor = new BABYLON.Color4(0.5, 0.52, 0.55, 1) // Gray overcast sky
      this.scene.fogColor = new BABYLON.Color3(0.55, 0.57, 0.6)
    } else if (!underClouds && !isDarkMode) {
      // Blue sky when above or at cloud level in day mode
      this.scene.clearColor = new BABYLON.Color4(0.6, 0.75, 0.9, 1)
      this.scene.fogColor = new BABYLON.Color3(0.7, 0.75, 0.8)
    }

    // Adjust scene fog when in clouds
    if (inClouds) {
      this.scene.fogStart = 5
      this.scene.fogEnd = 30
    }
  }

  dispose(): void {
    if (this.fogPostProcess) {
      this.fogPostProcess.dispose()
      this.fogPostProcess = null
    }
    if (this.cloudParticles) {
      this.cloudParticles.dispose()
      this.cloudParticles = null
    }
  }
}
