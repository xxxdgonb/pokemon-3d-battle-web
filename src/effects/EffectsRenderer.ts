import * as THREE from "three";

type ProceduralEffectKind="elemental"|"beam"|"slash"|"orb"|"impact";

const MOVE_PROFILES:Record<string,ProceduralEffectKind>={
  thunderbolt:"beam", thunder:"beam", icebeam:"beam", flamethrower:"beam", psychic:"beam", shadowball:"orb",
  energyball:"orb", aurasphere:"orb", waterpulse:"orb", dragonpulse:"beam", hyperbeam:"beam",
  closecombat:"slash", nightslash:"slash", airslash:"slash", psychocut:"slash", dragonclaw:"slash", shadowclaw:"slash",
  surf:"elemental", hydropump:"beam", waterfall:"beam", aquatail:"slash",
  earthquake:"elemental", bulldoze:"elemental", rockslide:"elemental", stoneedge:"slash",
  vinewhip:"slash", powerwhip:"slash", razorleaf:"slash", leafblade:"slash",
  solarbeam:"beam", dazzlinggleam:"beam", moonblast:"orb", darkpulse:"orb",
  fireblast:"orb", flareblitz:"slash", overheat:"beam", icefang:"slash", iciclecrash:"slash",
  psyshock:"orb", psybeam:"beam", focusblast:"orb", aurasphere:"orb"
};

interface ActiveEffect{
  readonly group:THREE.Group;
  readonly geometries:THREE.BufferGeometry[];
  frame:number;
}

const BEAM_TYPES=new Set(["electric","psychic","ice","fire"]);
const SLASH_TYPES=new Set(["fighting","steel","dark","ghost"]);
const ELEMENTAL_TYPES=new Set(["water","grass","ground","rock","fairy","poison","dragon","bug","flying"]);
const TYPE_COLORS:Record<string,number>={
  normal:0xd7dee8,fire:0xff744d,water:0x56a8ff,electric:0xffd84d,grass:0x68cf72,ice:0x9fe8ff,
  fighting:0xf08a52,poison:0xb16ad0,ground:0xc99258,flying:0x9ab4ff,psychic:0xff78bd,bug:0x9fcb45,
  rock:0xb9a98a,ghost:0x8273cb,dragon:0x7864f0,dark:0x6d6577,steel:0x98a7bd,fairy:0xf09ac9
};

export class EffectsRenderer{
  private readonly active=new Set<ActiveEffect>();
  private disposed=false;

  public constructor(private readonly scene:THREE.Scene){}

  public playProjectile(type:string,from:THREE.Object3D,to:THREE.Object3D,onImpact:()=>void,moveId?:string):Promise<void>{
    if(this.disposed){onImpact();return Promise.resolve();}
    const normalized=type.toLowerCase();
    const move=moveId?.toLowerCase().replace(/[^a-z0-9]/g,"");
    const color=TYPE_COLORS[normalized]??0xffffff;
    const profile=MOVE_PROFILES[move??""]??this.kindFor(normalized);
    const group=new THREE.Group();
    const core=new THREE.Mesh(
      profile==="beam"?new THREE.CylinderGeometry(.09,.09,1,12,1):new THREE.SphereGeometry(profile==="orb"?.2:.16,12,12),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95})
    );
    group.add(core);
    const trailGeometry=new THREE.SphereGeometry(.055,8,8);
    const trailMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75});
    const trails:THREE.Mesh[]=[];
    for(let i=0;i<5;i++){
      const trail=new THREE.Mesh(trailGeometry,trailMaterial.clone());
      trails.push(trail);
      group.add(trail);
    }
    const effect:ActiveEffect={group,geometries:[core.geometry,trailGeometry],frame:0};
    this.active.add(effect);
    const start=from.position.clone().add(new THREE.Vector3(0,1.1,0));
    const end=to.position.clone().add(new THREE.Vector3(0,1,0));
    const startTime=performance.now();
    let impacted=false;
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);if(!impacted){impacted=true;onImpact();}return;}
      const t=Math.min(1,(performance.now()-startTime)/360);
      const eased=t*t*(3-2*t);
      const position=start.clone().lerp(end,eased);
      position.y+=Math.sin(t*Math.PI)*.55;
      // Beam moves are presented as a growing spatial ray instead of a tiny
      // capsule. Orbs/slashes remain projectile-like and keep their trails.
      if(profile==="beam"){
        const direction=end.clone().sub(start).normalize();
        const distance=start.distanceTo(end);
        core.position.copy(start).lerp(end,eased*.5);
        core.position.y+=Math.sin(t*Math.PI)*.275;
        core.scale.set(1,Math.max(.001,distance*eased),1);
        core.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
        for(const trail of trails)trail.visible=false;
      }else{
        core.position.copy(position);
        // Signature trajectories keep moves visually distinct even when they
        // share the same broad effect family.
        if(move==="surf")core.position.y+=Math.sin(t*Math.PI*2)*.28;
        else if(move==="earthquake"||move==="bulldoze")core.position.y+=Math.abs(Math.sin(t*Math.PI*3))*.18;
        else if(move==="vinewhip"||move==="powerwhip"||move==="razorleaf"||move==="leafblade")core.rotation.z=Math.sin(t*Math.PI*2)*.9;
        else if(move==="moonblast"||move==="dazzlinggleam")core.scale.setScalar(1+Math.sin(t*Math.PI)*.45);
        for(let i=0;i<trails.length;i++){
          const trail=trails[i];
          if(!trail)continue;
          const trailT=Math.max(0,eased-(i+1)*.06);
          trail.position.lerpVectors(start,end,trailT);
          trail.position.y+=Math.sin(trailT*Math.PI)*.55;
          const material=trail.material as THREE.MeshBasicMaterial;
          material.opacity=.75*(1-Math.min(1,i/6));
        }
        const spin=performance.now()*0.008;
        core.rotation.x=spin;core.rotation.y=spin*1.3;
      }
      if(t<1){effect.frame=requestAnimationFrame(tick);}
      else{
        if(!impacted){impacted=true;onImpact();}
        this.disposeEffect(effect);
      }
    };
    effect.frame=requestAnimationFrame(tick);
    return new Promise(resolve=>{
      const check=():void=>{
        if(!this.active.has(effect)){resolve();return;}
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  public playTypeImpact(type:string,target:THREE.Object3D|null,moveId?:string):void{
    if(this.disposed)return;
    const normalized=type.toLowerCase();
    const move=moveId?.toLowerCase().replace(/[^a-z0-9]/g,"");
    const kind=MOVE_PROFILES[move??""]??this.kindFor(normalized);
    const geometry=kind==="slash"?new THREE.BoxGeometry(.08,.55,.08):kind==="beam"?new THREE.BoxGeometry(.13,.13,.8):new THREE.SphereGeometry(.12,12,12);
    const group=new THREE.Group();
    const color=TYPE_COLORS[normalized]??0xffffff;
    const count=move==="earthquake"||move==="bulldoze"?14:move==="fireblast"||move==="dazzlinggleam"?18:kind==="beam"?6:kind==="slash"?5:12;
    for(let i=0;i<count;i++){
      const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88});
      const mesh=new THREE.Mesh(geometry,material);
      const angle=(i/count)*Math.PI*2;
      if(kind==="beam"){
        mesh.position.set(0,(i-count/2)*.14,0);
        mesh.rotation.y=Math.PI/2;
        if(move==="thunderbolt"||move==="thunder")mesh.rotation.z=(i%2===0?1:-1)*.45;
        if(move==="icebeam")mesh.rotation.x=(i%2===0?1:-1)*.7;
      }else if(kind==="slash"){
        mesh.position.set(Math.cos(angle)*.55,.78+Math.sin(angle)*.3,0);
        mesh.rotation.z=angle;
      }else{
        mesh.position.set(Math.cos(angle)*.45,.8+Math.sin(angle)*.25,0);
        if(move==="earthquake"||move==="bulldoze")mesh.position.y=.25+Math.abs(Math.sin(angle))*1.0;
        if(move==="fireblast")mesh.scale.setScalar(1.15);
      }
      group.add(mesh);
    }
    if(target)group.position.copy(target.position);
    this.scene.add(group);
    const effect:ActiveEffect={group,geometries:[geometry],frame:0};
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);return;}
      const t=Math.min(1,(performance.now()-start)/420);
      group.scale.setScalar(1+t*(kind==="beam"?1.2:1.6));
      group.children.forEach((child,i)=>{
        if(kind==="beam")child.position.z-=.025;
        else child.position.y+=.008+(i%3)*.002;
        const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity=.88*(1-t);
      });
      if(t<1)effect.frame=requestAnimationFrame(tick);else this.disposeEffect(effect);
    };
    effect.frame=requestAnimationFrame(tick);
  }

  public playStatusEffect(target:THREE.Object3D|null,status:string):void{
    if(this.disposed||!target)return;
    const palette:Record<string,number>={brn:0xff6633,par:0xffd84d,psn:0xb36ad8,tox:0x8f4db7,slp:0x7d91b8,frz:0x9fe8ff,ability:0xffc857,item:0x9cc9ff,heal:0x67e8a5};
    const color=palette[status.toLowerCase()]??0xffffff;
    const geometry=new THREE.SphereGeometry(.09,10,10);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9});
    const group=new THREE.Group();
    for(let i=0;i<10;i++){
      const mesh=new THREE.Mesh(geometry,material.clone());
      const angle=(i/10)*Math.PI*2;
      mesh.position.set(Math.cos(angle)*.48,.65+Math.sin(angle)*.2,Math.sin(angle)*.48);
      group.add(mesh);
    }
    group.position.copy(target.position);
    this.scene.add(group);
    const effect:ActiveEffect={group,geometries:[geometry],frame:0};
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);return;}
      const t=Math.min(1,(performance.now()-start)/650);
      group.rotation.y=t*Math.PI*1.8;
      group.scale.setScalar(.7+t*.9);
      group.children.forEach((child,i)=>{
        child.position.y+=.002+(i%2)*.001;
        const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity=.9*(1-t);
      });
      if(t<1)effect.frame=requestAnimationFrame(tick);else this.disposeEffect(effect);
    };
    effect.frame=requestAnimationFrame(tick);
  }

  public playHealEffect(target:THREE.Object3D|null):void{
    if(this.disposed||!target)return;
    this.playStatusEffect(target,"heal");
  }

  public playStageEffect(target:THREE.Object3D|null,positive:boolean):void{
    if(this.disposed||!target)return;
    const color=positive?0x67e8a5:0xff7185;
    const geometry=new THREE.RingGeometry(.22,.3,20);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.82,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(geometry,material);
    ring.rotation.x=-Math.PI/2;
    ring.position.copy(target.position);
    ring.position.y+=.12;
    this.scene.add(ring);
    const effect:ActiveEffect={group:new THREE.Group(),geometries:[geometry],frame:0};
    effect.group.add(ring);
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);return;}
      const t=Math.min(1,(performance.now()-start)/520);
      ring.scale.setScalar(.5+t*1.7);
      ring.position.y=target.position.y+.12+t*.9;
      material.opacity=.82*(1-t);
      if(t<1)effect.frame=requestAnimationFrame(tick);else this.disposeEffect(effect);
    };
    effect.frame=requestAnimationFrame(tick);
  }

  public playMissEffect(target:THREE.Object3D|null):void{
    if(this.disposed||!target)return;
    const geometry=new THREE.BoxGeometry(.07,.72,.07);
    const group=new THREE.Group();
    for(const angle of [Math.PI/4,-Math.PI/4]){
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xe7edf6,transparent:true,opacity:.85}));
      mesh.rotation.z=angle;
      mesh.position.y=.9;
      group.add(mesh);
    }
    group.position.copy(target.position);
    this.scene.add(group);
    const effect:ActiveEffect={group,geometries:[geometry],frame:0};
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);return;}
      const t=Math.min(1,(performance.now()-start)/360);
      group.scale.setScalar(.7+t*.8);
      group.children.forEach(child=>((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=.85*(1-t));
      if(t<1)effect.frame=requestAnimationFrame(tick);else this.disposeEffect(effect);
    };
    effect.frame=requestAnimationFrame(tick);
  }

  private kindFor(type:string):ProceduralEffectKind{
    if(BEAM_TYPES.has(type))return "beam";
    if(SLASH_TYPES.has(type))return "slash";
    if(ELEMENTAL_TYPES.has(type))return "elemental";
    return "impact";
  }

  public dispose():void{
    if(this.disposed)return;
    this.disposed=true;
    for(const effect of [...this.active]){cancelAnimationFrame(effect.frame);this.disposeEffect(effect);}
    this.active.clear();
  }

  private disposeEffect(effect:ActiveEffect):void{
    if(this.active.has(effect))this.active.delete(effect);
    this.scene.remove(effect.group);
    effect.group.traverse(object=>{
      const mesh=object as THREE.Mesh;
      const material=mesh.material;
      if(Array.isArray(material))material.forEach(item=>item.dispose());
      else material?.dispose();
    });
    for(const geometry of effect.geometries)geometry.dispose();
  }
}
