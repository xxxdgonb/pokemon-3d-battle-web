import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
}

export class PokemonModelLoader {
  private readonly loader=new GLTFLoader();
  private readonly cache=new Map<string,THREE.Group>();

  public async load(request:PokemonModelRequest):Promise<THREE.Group|null>{
    const category=request.shiny?"shiny":"regular";
    const key=`${category}/${request.nationalDex}`;
    const cached=this.cache.get(key);
    if(cached)return cached.clone(true);
    const url=`https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/${category}/${request.nationalDex}.glb`;
    try{
      const gltf=await this.loader.loadAsync(url);
      this.cache.set(key,gltf.scene);
      return gltf.scene.clone(true);
    }catch{
      return null;
    }
  }

  public dispose():void{
    for(const model of this.cache.values()){
      model.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(mesh.geometry)mesh.geometry.dispose();
        const material=mesh.material;
        if(Array.isArray(material))material.forEach(m=>m.dispose());
        else material?.dispose();
      });
    }
    this.cache.clear();
  }
}
