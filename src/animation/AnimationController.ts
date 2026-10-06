import * as THREE from "three";

export type PokemonAnimation = "idle" | "attack" | "hit" | "hurt" | "faint" | "victory";

export class AnimationController {
  private readonly base = new WeakMap<THREE.Object3D, {position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3}>();

  private snapshot(model: THREE.Object3D): {position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3} {
    const existing=this.base.get(model);
    if(existing)return existing;
    const value={position:model.position.clone(),rotation:model.rotation.clone(),scale:model.scale.clone()};
    this.base.set(model,value);
    return value;
  }

  public play(model: THREE.Object3D, animation: PokemonAnimation, duration=500): Promise<void> {
    const base=this.snapshot(model);
    const start=performance.now();
    const origin=base.position.clone();
    const originRotation=base.rotation.clone();
    return new Promise(resolve=>{
      const tick=():void=>{
        const t=Math.min(1,(performance.now()-start)/duration);
        const wave=Math.sin(t*Math.PI);
        model.position.copy(origin);
        model.rotation.copy(originRotation);
        if(animation==="attack"){
          model.position.z-=wave*.65;
          model.position.y+=wave*.12;
          model.rotation.x-=wave*.12;
        }else if(animation==="hit"||animation==="hurt"){
          model.position.x+=Math.sin(t*Math.PI*4)*.08*(1-t);
          model.rotation.z+=Math.sin(t*Math.PI*3)*.08*(1-t);
        }else if(animation==="faint"){
          model.rotation.z=originRotation.z+wave*(Math.PI/2);
          model.position.y=origin.y-wave*.55;
        }else if(animation==="victory"){
          model.position.y+=wave*.25;
          model.rotation.y=originRotation.y+wave*.25;
        }
        if(t<1)requestAnimationFrame(tick);
        else{model.position.copy(origin);model.rotation.copy(originRotation);resolve();}
      };
      requestAnimationFrame(tick);
    });
  }

  public reset(model: THREE.Object3D):void {
    const base=this.snapshot(model);
    model.position.copy(base.position);
    model.rotation.copy(base.rotation);
    model.scale.copy(base.scale);
  }
}
