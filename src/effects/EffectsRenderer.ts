import * as THREE from "three";

type ProceduralEffectKind = "elemental" | "beam" | "slash" | "impact";

interface ActiveEffect {
  readonly group: THREE.Group;
  readonly geometry: THREE.BufferGeometry;
  frame: number;
}

const BEAM_TYPES=new Set(["electric","psychic","ice","fire"]);
const SLASH_TYPES=new Set(["fighting","steel","dark","ghost"]);
const ELEMENTAL_TYPES=new Set(["water","grass","ground","rock","fairy","poison","dragon","bug","flying"]);

export class EffectsRenderer {
  private readonly active=new Set<ActiveEffect>();
  private disposed=false;

  public playTypeImpact(type:string,target:THREE.Object3D|null):void{
    if(this.disposed)return;
    const kind=this.kindFor(type);
    const group=new THREE.Group();
    const geometry=kind==="slash"?new THREE.BoxGeometry(.08,.55,.08):new THREE.SphereGeometry(.12,12,12);
    const count=kind==="beam"?6:kind==="slash"?4:10;
    for(let i=0;i<count;i++){
      const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.85});
      const p=new THREE.Mesh(geometry,material);
      const angle=(i/count)*Math.PI*2;
      if(kind==="beam")p.position.set(0,(i-count/2)*.18,0);
      else if(kind==="slash")p.position.set(Math.cos(angle)*.55,.8+Math.sin(angle)*.3,0);
      else p.position.set(Math.cos(angle)*.45,.8+Math.sin(angle)*.25,0);
      if(kind==="slash")p.rotation.z=angle;
      group.add(p);
    }
    if(target)group.position.copy(target.position);
    this.scene.add(group);
    const effect:ActiveEffect={group,geometry,frame:0};
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){this.disposeEffect(effect);return;}
      const t=Math.min(1,(performance.now()-start)/420);
      group.scale.setScalar(1+t*(kind==="beam"?1.2:1.6));
      group.children.forEach((child,i)=>{
        if(kind==="beam")child.position.z-=.025;
        else child.position.y+=.008+(i%3)*.002;
      });
      if(t<1)effect.frame=requestAnimationFrame(tick);else this.disposeEffect(effect);
    };
    effect.frame=requestAnimationFrame(tick);
  }

  private kindFor(type:string):ProceduralEffectKind{
    const normalized=type.toLowerCase();
    if(BEAM_TYPES.has(normalized))return "beam";
    if(SLASH_TYPES.has(normalized))return "slash";
    if(ELEMENTAL_TYPES.has(normalized))return "elemental";
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
    effect.geometry.dispose();
  }
}
