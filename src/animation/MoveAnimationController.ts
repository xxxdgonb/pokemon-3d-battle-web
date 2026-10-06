import * as THREE from "three";
import { AnimationController } from "./AnimationController";

export interface MoveAnimationRequest {
  readonly actor: THREE.Object3D;
  readonly target: THREE.Object3D | null;
  readonly onImpact: () => void;
}

export class MoveAnimationController {
  public constructor(private readonly animations: AnimationController) {}

  public async play(request: MoveAnimationRequest): Promise<void> {
    const impactAt=330;
    let impacted=false;
    const impactTimer=window.setTimeout(()=>{impacted=true;request.onImpact();},impactAt);
    try {
      await this.animations.play(request.actor,"attack",650);
      if(!impacted){window.clearTimeout(impactTimer);request.onImpact();}
      if(request.target)void this.animations.play(request.target,"hit",220);
    }finally{
      window.clearTimeout(impactTimer);
    }
  }
}
