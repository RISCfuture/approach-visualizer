import * as BABYLON from 'babylonjs'

/**
 * Safely create a mesh with error handling and scene validation
 */
export function createMesh<T extends BABYLON.Mesh>(
  createFn: () => T,
  fallbackName: string,
  scene: BABYLON.Scene,
): T | null {
  // Validate scene
  if (scene.isDisposed) {
    console.warn(`Cannot create mesh "${fallbackName}": Scene is not available or disposed`)
    return null
  }

  try {
    return createFn()
  } catch (error) {
    console.error(`Failed to create mesh "${fallbackName}":`, error)
    return null
  }
}

/**
 * Safely create a sphere mesh
 */
export function createSphere(
  name: string,
  options: { diameter?: number; segments?: number } = {},
  scene: BABYLON.Scene,
): BABYLON.Mesh | null {
  return createMesh(() => BABYLON.MeshBuilder.CreateSphere(name, options, scene), name, scene)
}

/**
 * Safely dispose of a mesh
 */
export function disposeMesh(mesh: BABYLON.Mesh | null): void {
  if (mesh && !mesh.isDisposed()) {
    try {
      mesh.dispose()
    } catch (error) {
      console.error('Failed to dispose mesh:', error)
    }
  }
}

/**
 * Safely dispose of a material
 */
export function disposeMaterial(material: BABYLON.Material | null): void {
  if (material) {
    try {
      material.dispose()
    } catch (error) {
      console.error('Failed to dispose material:', error)
    }
  }
}

/**
 * Safely dispose of an array of meshes
 */
export function disposeMeshes(meshes: BABYLON.Mesh[]): void {
  meshes.forEach((mesh) => {
    disposeMesh(mesh)
  })
}

/**
 * Validate scene before operations
 */
export function isSceneReady(scene: BABYLON.Scene | null): boolean {
  return scene !== null && !scene.isDisposed
}
