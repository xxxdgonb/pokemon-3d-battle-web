import * as THREE from "three";

export type PokemonAnimation="idle"|"attack"|"hit"|"hurt"|"faint"|"victory";

function nativeWords(animation:PokemonAnimation):readonly string[]{
  if(animation==="idle")return ["idle","stand","breath"];
  if(animation==="attack")return ["attack","move","action"];
  if(animation==="hit"||animation==="hurt")return ["hit","hurt","damage"];
  if(animation==="faint")return ["faint","death","die"];
  return ["victory","win","celebrate"];
}

type Snapshot={position:THREE.Vector3;rotation:THREE.Euler;scale:THREE.Vector3};

export class AnimationController{
  private readonly base=new WeakMap<THREE.Object3D,Snapshot>();
  private readonly mixers=new WeakMap<THREE.Object3D,THREE.AnimationMixer>();
  private readonly animatedModels=new Set<THREE.Object3D>();
  private idleClock=0;

  private snapshot(model:THREE.Object3D):Snapshot{
    const existing=this.base.get(model);
    if(existing)return existing;
    const value={position:model.position.clone(),rotation:model.rotation.clone(),scale:model.scale.clone()};
    this.base.set(model,value);
    return value;
  }

  private native(model:THREE.Object3D,animation:PokemonAnimation,duration?:number):THREE.AnimationAction|null{
    const clips=model.userData.animationClips as THREE.AnimationClip[]|undefined;
    if(!Array.isArray(clips)||clips.length===0)return null;

    // Never feed deserialized/plain-object clips to AnimationMixer.
    // SkeletonUtils cloning is handled by PokemonModelLoader, but this guard
    // keeps the renderer safe if another loader supplies userData clips.
    const validClips=clips.filter((clip):clip is THREE.AnimationClip=>
      clip instanceof THREE.AnimationClip &&
      Array.isArray(clip.tracks) &&
      clip.tracks.length>0 &&
      clip.tracks.every(track=>track && typeof (track as unknown as {createInterpolant?: unknown}).createInterpolant==="function")
    );
    if(validClips.length===0)return null;

    const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"");
    const names=validClips.map(clip=>({clip,name:normalized(clip.name)}));
    const exactWords=nativeWords(animation).map(normalized);
    const exact=names.find(item=>exactWords.some(word=>item.name===word))?.clip;
    const partial=names.find(item=>exactWords.some(word=>item.name.startsWith(word)||item.name.endsWith(word)))?.clip;
    const idleLike=names.find(item=>["idle","stand","breath","wait","walk"].some(word=>item.name.includes(word)))?.clip;
    const actionLike=names.find(item=>["attack","action","move","hit","hurt","damage","faint","victory","win"].some(word=>item.name.includes(word)))?.clip;
    // Generic clips are safe as an idle fallback, but never reuse an unknown
    // clip for attack/hit/faint. Doing that makes an idle animation play during
    // a move and is one of the main causes of visibly broken battle motion.
    const clip=exact
      ?? partial
      ?? (animation==="idle"?idleLike:actionLike)
      ?? (animation==="idle"?validClips[0]:null)
      ?? null;
    if(!clip)return null;
    let mixer=this.mixers.get(model);
    if(!mixer){
      mixer=new THREE.AnimationMixer(model);
      this.mixers.set(model,mixer);
      this.animatedModels.add(model);
    }
    mixer.stopAllAction();
    const action=mixer.clipAction(clip,model);
    action.reset();
    action.clampWhenFinished=animation==="faint";
    action.setLoop(animation==="idle"?THREE.LoopRepeat:THREE.LoopOnce,animation==="idle"?Infinity:1);
    if(animation!=="idle")action.setDuration(Math.max(.08,(duration??(animation==="attack"?.65:animation==="faint"?.52:.32))/1000));
    action.fadeIn(animation==="idle"?.12:.06);
    action.play();
    return action;
  }

  public startIdle(model:THREE.Object3D):void{
    this.snapshot(model);
    model.userData.idleActive=true;
    model.userData.idlePhase=Math.random()*Math.PI*2;
    const action=this.native(model,"idle");
    if(!action)model.userData.idleProcedural=true;
  }

  public stopIdle(model:THREE.Object3D):void{
    model.userData.idleActive=false;
    model.userData.idleProcedural=false;
    this.mixers.get(model)?.stopAllAction();
  }

  public update(deltaSeconds:number):void{
    this.idleClock+=Math.max(0,deltaSeconds);
    for(const model of this.animatedModels)this.mixers.get(model)?.update(Math.min(.05,Math.max(0,deltaSeconds)));
    for(const model of this.animatedModels){
      if(!model.userData.idleActive||!model.userData.idleProcedural)continue;
      const base=this.snapshot(model);
      const phase=Number(model.userData.idlePhase??0);
      const wave=Math.sin(this.idleClock*2+phase);
      model.position.y=base.position.y+wave*.035;
      model.rotation.z=base.rotation.z+wave*.018;
    }
  }

  public play(model:THREE.Object3D,animation:PokemonAnimation,duration=500):Promise<void>{
    const base=this.snapshot(model);
    this.stopIdle(model);
    const action=this.native(model,animation,duration);
    const start=performance.now(),origin=base.position.clone(),originRotation=base.rotation.clone();
    return new Promise(resolve=>{
      const tick=():void=>{
        const now=performance.now(),t=Math.min(1,(now-start)/duration);
        if(!action)this.animateFallback(model,animation,t,origin,originRotation);
        if(t<1)requestAnimationFrame(tick);
        else{
          action?.fadeOut(.08);
          action?.stop();
          model.position.copy(origin);
          model.rotation.copy(originRotation);
          if(animation!=="faint")this.startIdle(model);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private animateFallback(
    model:THREE.Object3D,
    animation:PokemonAnimation,
    t:number,
    origin:THREE.Vector3,
    originRotation:THREE.Euler
  ):void{
    const wave=Math.sin(t*Math.PI);
    model.position.copy(origin);
    model.rotation.copy(originRotation);
    if(animation==="attack"){model.position.z-=wave*.65;model.position.y+=wave*.12;model.rotation.x-=wave*.12;}
    else if(animation==="hit"||animation==="hurt"){model.position.x+=Math.sin(t*Math.PI*4)*.08*(1-t);model.rotation.z+=Math.sin(t*Math.PI*3)*.08*(1-t);}
    else if(animation==="faint"){model.rotation.z=originRotation.z+wave*(Math.PI/2);model.position.y=origin.y-wave*.55;}
    else if(animation==="victory"){model.position.y+=wave*.25;model.rotation.y=originRotation.y+wave*.25;}
  }

  public reset(model:THREE.Object3D):void{
    this.stopIdle(model);
    const base=this.snapshot(model);
    model.position.copy(base.position);model.rotation.copy(base.rotation);model.scale.copy(base.scale);
  }

  public dispose(model?:THREE.Object3D):void{
    if(model){
      this.stopIdle(model);
      this.mixers.get(model)?.stopAllAction();
      this.mixers.delete(model);
      this.animatedModels.delete(model);
      return;
    }
    for(const item of this.animatedModels)this.mixers.get(item)?.stopAllAction();
    this.animatedModels.clear();
  }
}
