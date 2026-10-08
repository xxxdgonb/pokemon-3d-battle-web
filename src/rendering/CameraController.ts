import * as THREE from "three";

export type CameraPreset="intro"|"default"|"move"|"target"|"impact"|"faint"|"victory";

interface CameraTarget{
  readonly position:THREE.Vector3;
  readonly look:THREE.Vector3;
}

export class CameraController{
  private readonly presets:Record<CameraPreset,CameraTarget>={
    intro:{position:new THREE.Vector3(0,5,13),look:new THREE.Vector3(0,1,0)},
    default:{position:new THREE.Vector3(0,4.5,10),look:new THREE.Vector3(0,1.5,0)},
    move:{position:new THREE.Vector3(-1,4,8),look:new THREE.Vector3(0,1.2,0)},
    target:{position:new THREE.Vector3(2,3.8,8),look:new THREE.Vector3(1,1.2,0)},
    impact:{position:new THREE.Vector3(0,4,8),look:new THREE.Vector3(0,1.2,0)},
    faint:{position:new THREE.Vector3(0,5.2,11),look:new THREE.Vector3(0,1,0)},
    victory:{position:new THREE.Vector3(0,5.5,12),look:new THREE.Vector3(0,1.4,0)}
  };
  private targetPosition:THREE.Vector3;
  private targetLook:THREE.Vector3;
  private initialized=false;
  private shakeTime=0;
  private shakeStrength=0;

  public constructor(private readonly camera:THREE.PerspectiveCamera){
    const preset=this.presets.default;
    this.targetPosition=preset.position.clone();
    this.targetLook=preset.look.clone();
    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.targetLook);
    this.initialized=true;
  }

  public set(preset:CameraPreset):void{
    const value=this.presets[preset];
    this.targetPosition.copy(value.position);
    this.targetLook.copy(value.look);
    if(!this.initialized){
      this.camera.position.copy(this.targetPosition);
      this.camera.lookAt(this.targetLook);
    }
  }

  public shake(strength=.12,duration=.18):void{
    this.shakeStrength=Math.max(this.shakeStrength,strength);
    this.shakeTime=Math.max(this.shakeTime,duration);
  }

  public update(deltaSeconds:number):void{
    const smoothing=1-Math.exp(-Math.max(0,deltaSeconds)*8);
    this.camera.position.lerp(this.targetPosition,smoothing);
    if(this.shakeTime>0){
      this.shakeTime=Math.max(0,this.shakeTime-deltaSeconds);
      const falloff=Math.min(1,this.shakeTime/.18);
      const wave=this.shakeTime*48;
      this.camera.position.x+=Math.sin(wave*1.7)*this.shakeStrength*falloff;
      this.camera.position.y+=Math.cos(wave*1.3)*this.shakeStrength*.7*falloff;
    }
    const currentLook=this.camera.userData.lookTarget as THREE.Vector3|undefined;
    const look=currentLook??this.targetLook.clone();
    look.lerp(this.targetLook,smoothing);
    this.camera.userData.lookTarget=look;
    this.camera.lookAt(look);
  }
}
