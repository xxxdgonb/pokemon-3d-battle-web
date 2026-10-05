import * as THREE from "three";

export class ThreeBattleRenderer {
  public readonly scene = new THREE.Scene();
  public readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  public readonly renderer: THREE.WebGLRenderer;

  public constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 3, 8);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2));
  }

  public resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
