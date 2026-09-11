/**
 * The slice of BabylonJS this scene uses, re-exported from `@babylonjs/core`'s
 * per-feature entry points.
 *
 * Each entry point both defines its class and registers whatever engine-side
 * behaviour that class depends on, so pulling the symbols from here — rather
 * than from the package root — lets the bundler drop the loaders, GUI,
 * physics, node materials and XR the app never touches.
 */

// Materials and textures
export { Material } from '@babylonjs/core/Materials/material'
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
export { Texture } from '@babylonjs/core/Materials/Textures/texture'

// Maths
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
export { Vector3 } from '@babylonjs/core/Maths/math.vector'

// Engine and scene graph
export { Engine } from '@babylonjs/core/Engines/engine'
export { Scene } from '@babylonjs/core/scene'
export { Mesh } from '@babylonjs/core/Meshes/mesh'
export { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'

// Cameras
export { Camera } from '@babylonjs/core/Cameras/camera'
export { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'

// Lights and effects
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
export { GlowLayer } from '@babylonjs/core/Layers/glowLayer'
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
export { PostProcess } from '@babylonjs/core/PostProcesses/postProcess'
