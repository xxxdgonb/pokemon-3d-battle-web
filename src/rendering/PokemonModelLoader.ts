import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
  readonly formId?:string;
}

export class PokemonModelLoader {
  private readonly loader=new GLTFLoader();
  private readonly draco=new DRACOLoader();
  public constructor(){
    this.draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    this.loader.setDRACOLoader(this.draco);
  }
  private readonly cache=new Map<string,THREE.Group>();
  private readonly pending=new Map<string,Promise<THREE.Group|null>>();

  public async load(request:PokemonModelRequest):Promise<THREE.Group|null>{
    const categories:string[]=[];
    const form=request.formId?.toLowerCase();
    const aliases=form && form!=="base" ? (form.includes("mega")?["mega"]:form.includes("gigantamax")||form.includes("gmax")?["gmax"]:form.includes("alola")?["alolan"]:form.includes("galar")?["galarian"]:form.includes("hisui")?["hisuian"]:form.includes("primal")?["primal"]:form.includes("origin")?["origin"]:[]) : [];
    if(aliases.length){
      if(request.shiny)categories.push(...aliases.map(alias=>`shiny-${alias}`),...aliases);
    }
    if(request.shiny)categories.push("shiny");
    categories.push("regular");
    for(const category of categories){
      const key=`${category}/${request.nationalDex}`;
      const cached=this.cache.get(key);
      if(cached)return cached.clone(true);
      const inFlight=this.pending.get(key);
      if(inFlight){
        const model=await inFlight;
        if(model)return model.clone(true);
        continue;
      }
      const promise=this.fetchModel(category,request.nationalDex,key);
      this.pending.set(key,promise);
      const model=await promise;
      if(model)return model.clone(true);
    }
    return null;
  }

  private async fetchModel(category:string,nationalDex:number,key:string):Promise<THREE.Group|null>{
    try{
      const url=`https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/${category}/${nationalDex}.glb`;
      const gltf=await this.loader.loadAsync(url);
      this.cache.set(key,gltf.scene);
      return gltf.scene;
    }catch(error){
      void error;
      return null;
    }finally{
      this.pending.delete(key);
    }
  }

  public dispose():void{
    this.pending.clear();
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
    this.draco.dispose();
  }
}
