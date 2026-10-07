import * as THREE from "three";

type ProceduralEffectKind="elemental"|"beam"|"slash"|"impact";

interface ActiveEffect{
  readonly group:THREE.Group;
  readonly geometry:THREE.BufferGeometry;
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

  public playTypeImpact(type:string,target:THREE.Object3D|null):void{
    if(this.disposed)return;
    const normalized=type.toLowerCase();
    const kind=this.kindFor(normalized);
    const geometry=kind==="slash"?new THREE.BoxGeometry(.08,.55,.08):kind==="beam"?new THREE.BoxGeometry(.13,.13,.8):new THREE.SphereGeometry(.12,12,12);
    const group=new THREE.Group();
    const color=TYPE_COLORS[normalized]??0xffffff;
    const count=kind==="beam"?6:kind==="slash"?4:10;
    for(let i=0;i<count;i++){
      const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88});
      const mesh=new THREE.Mesh(geometry,material);
      const angle=(i/count)*Math.PI*2;
      if(kind==="beam"){
        mesh.position.set(0,(i-count/2)*.14,0);
        mesh.rotation.y=Math.PI/2;
      }else if(kind==="slash"){
        mesh.position.set(Math.cos(angle)*.55,.78+Math.sin(angle)*.3,0);
        mesh.rotation.z=angle;
      }else{
        mesh.position.set(Math.cos(angle)*.45,.8+Math.sin(angle)*.25,0);
      }
      group.add(mesh);
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
        const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity=.88*(1-t);
      });
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
    effect.geometry.dispose();
  }
}
