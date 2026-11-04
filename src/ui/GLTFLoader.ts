/**
 * GLTFLoader — Three.js glTF 2.0 integration for Blender-authored assets.
 * Draco/KTX2 decoders self-hosted in public/draco/ (not CDN in prod).
 * Supports LOD swap via THREE.LOD (glTF has no native LOD).
 */

import { GLTFLoader as ThreeGLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class How2SoapGLTFLoader {
  private loader = new ThreeGLTFLoader();
  private draco: DRACOLoader | null = null;

  constructor() {
    // Draco decoder self-hosted (prod) — never CDN
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(this.draco);
  }

  /**
   * Load a Blender-exported .glb.
   * @param url Path under /assets/ (e.g. '/assets/buildings/house.glb')
   * @returns Promise resolving to the Three.js scene/groups
   */
  async load(url: string): Promise<import('three').Group> {
    const gltf = await this.loader.loadAsync(url);
    gltf.scene.traverse((o) => {
      if ((o as import('three').Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return gltf.scene;
  }

  /**
   * Build a THREE.LOD object (manual LOD — glTF has no native LOD extension).
   * @param highUrl .glb at LOD0 (full)
   * @param lowUrl .glb at LOD1 (50% Decimate) or LOD2 (25%)
   * @param distance Metres at which LOD1 activates (e.g. 40)
   */
  async loadLOD(highUrl: string, lowUrl: string, distance = 40): Promise<import('three').LOD> {
    const THREE = await import('three');
    const high = await this.load(highUrl);
    const low = await this.load(lowUrl);
    const lod = new THREE.LOD();
    lod.addLevel(high, 0);
    lod.addLevel(low, distance);
    return lod;
  }

  dispose() {
    this.draco?.dispose();
  }
}
