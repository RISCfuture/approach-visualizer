import * as BABYLON from 'babylonjs'

export class SafeMeshBuilder {
  /**
   * Safely create a mesh with error handling and scene validation
   */
  static createMesh<T extends BABYLON.Mesh>(
    createFn: () => T,
    fallbackName: string,
    scene: BABYLON.Scene,
  ): T | null {
    // Validate scene
    if (!scene || scene.isDisposed) {
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
  static createSphere(
    name: string,
    options: { diameter?: number; segments?: number } = {},
    scene: BABYLON.Scene,
  ): BABYLON.Mesh | null {
    return this.createMesh(
      () => BABYLON.MeshBuilder.CreateSphere(name, options, scene),
      name,
      scene,
    )
  }

  /**
   * Safely create a box mesh
   */
  static createBox(
    name: string,
    options: { size?: number; width?: number; height?: number; depth?: number } = {},
    scene: BABYLON.Scene,
  ): BABYLON.Mesh | null {
    return this.createMesh(() => BABYLON.MeshBuilder.CreateBox(name, options, scene), name, scene)
  }

  /**
   * Safely create a ground mesh
   */
  static createGround(
    name: string,
    options: { width?: number; height?: number; subdivisions?: number } = {},
    scene: BABYLON.Scene,
  ): BABYLON.Mesh | null {
    return this.createMesh(
      () => BABYLON.MeshBuilder.CreateGround(name, options, scene),
      name,
      scene,
    )
  }

  /**
   * Safely dispose of a mesh
   */
  static disposeMesh(mesh: BABYLON.Mesh | null): void {
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
  static disposeMaterial(material: BABYLON.Material | null): void {
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
  static disposeMeshes(meshes: BABYLON.Mesh[]): void {
    meshes.forEach((mesh) => this.disposeMesh(mesh))
  }

  /**
   * Validate scene before operations
   */
  static isSceneReady(scene: BABYLON.Scene | null): boolean {
    return scene !== null && !scene.isDisposed
  }
}
