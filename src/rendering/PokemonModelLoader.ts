import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
  readonly formId?:string;
}

export class PokemonModelLoader {
  private readonly loader=new GLTFLoader();
  private readonly cache=new Map<string,THREE.Group>();

  public async load(request:PokemonModelRequest):Promise<THREE.Group|null>{
    const categories=[request.shiny?"shiny":"regular"];
    if(request.formId && request.formId!=="base"){
      const form=request.formId.toLowerCase();
      const aliases=form.includes("mega")?["mega"]:form.includes("gigantamax")?["gigantamax"]:form.includes("alola")?["alolan"]:form.includes("galar")?["galarian"]:form.includes("hisui")?["hisuian"]:[form];
      categories.unshift(...aliases);
    }
    for(const category of categories){
      const key=`${category}/${request.nationalDex}`;
      const cached=this.cache.get(key);
      if(cached)return cached.clone(true);
      const url=`https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/${category}/${request.nationalDex}.glb`;
      try{
        const gltf=await this.loader.loadAsync(url);
        this.cache.set(key,gltf.scene);
        return gltf.scene.clone(true);
      }catch{}
    }
    return null;
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
