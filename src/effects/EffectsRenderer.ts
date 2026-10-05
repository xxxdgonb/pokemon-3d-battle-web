import * as THREE from "three";

export class EffectsRenderer {
  public constructor(private readonly scene:THREE.Scene){}

  public playTypeImpact(type:string,target:THREE.Object3D|null):void{
    const group=new THREE.Group();
    const geometry=new THREE.SphereGeometry(.12,12,12);
    const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.85});
    for(let i=0;i<10;i++){
      const p=new THREE.Mesh(geometry,material.clone());
      const angle=(i/10)*Math.PI*2;
      p.position.set(Math.cos(angle)*.45,.8+Math.sin(angle)*.25,0);
      group.add(p);
    }
    if(target)group.position.copy(target.position);
    this.scene.add(group);
    const start=performance.now();
    const tick=()=>{
      const t=Math.min(1,(performance.now()-start)/420);
      group.scale.setScalar(1+t*1.6);
      group.children.forEach((child,i)=>{child.position.y+=.008+(i%3)*.002;});
      if(t<1)requestAnimationFrame(tick);else{
        group.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material){if(Array.isArray(m.material))m.material.forEach(x=>x.dispose());else m.material.dispose();}});
        this.scene.remove(group);
      }
    };
    requestAnimationFrame(tick);
    void type;
  }
}
