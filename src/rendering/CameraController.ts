import * as THREE from "three";
export type CameraPreset="intro"|"default"|"move"|"target"|"impact"|"faint"|"victory";
export class CameraController{
  private readonly presets:Record<CameraPreset,{position:THREE.Vector3;look:THREE.Vector3}>={
    intro:{position:new THREE.Vector3(0,5,13),look:new THREE.Vector3(0,1,0)},
    default:{position:new THREE.Vector3(0,4.5,10),look:new THREE.Vector3(0,1.5,0)},
    move:{position:new THREE.Vector3(-1,4,8),look:new THREE.Vector3(0,1.2,0)},
    target:{position:new THREE.Vector3(2,3.8,8),look:new THREE.Vector3(1,1.2,0)},
    impact:{position:new THREE.Vector3(0,4,8),look:new THREE.Vector3(0,1.2,0)},
    faint:{position:new THREE.Vector3(0,5.2,11),look:new THREE.Vector3(0,1,0)},
    victory:{position:new THREE.Vector3(0,5.5,12),look:new THREE.Vector3(0,1.4,0)}
  };
  public constructor(private readonly camera:THREE.PerspectiveCamera){this.set("default");}
  public set(preset:CameraPreset):void{const p=this.presets[preset];this.camera.position.copy(p.position);this.camera.lookAt(p.look);}
}
