import * as THREE from "three";

interface ActiveEffect {
  readonly group: THREE.Group;
  readonly geometry: THREE.BufferGeometry;
  frame: number;
}

export class EffectsRenderer {
  private readonly active=new Set<ActiveEffect>();
  private disposed=false;

  public constructor(private readonly scene:THREE.Scene){}

  public playTypeImpact(type:string,target:THREE.Object3D|null):void{
    if(this.disposed)return;
    const group=new THREE.Group();
    const geometry=new THREE.SphereGeometry(.12,12,12);
    for(let i=0;i<10;i++){
      const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.85});
      const p=new THREE.Mesh(geometry,material);
      const angle=(i/10)*Math.PI*2;
      p.position.set(Math.cos(angle)*.45,.8+Math.sin(angle)*.25,0);
      group.add(p);
    }
    if(target)group.position.copy(target.position);
    this.scene.add(group);

    const effect:ActiveEffect={group,geometry,frame:0};
    this.active.add(effect);
    const start=performance.now();
    const tick=():void=>{
      if(this.disposed){
        this.disposeEffect(effect);
        return;
      }
      const t=Math.min(1,(performance.now()-start)/420);
      group.scale.setScalar(1+t*1.6);
      group.children.forEach((child,i)=>{child.position.y+=.008+(i%3)*.002;});
      if(t<1){
        effect.frame=requestAnimationFrame(tick);
      }else{
        this.disposeEffect(effect);
      }
    };
    effect.frame=requestAnimationFrame(tick);
    void type;
  }

  public dispose():void{
    if(this.disposed)return;
    this.disposed=true;
    for(const effect of [...this.active]){
      cancelAnimationFrame(effect.frame);
      this.disposeEffect(effect);
    }
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
