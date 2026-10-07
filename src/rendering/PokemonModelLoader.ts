import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
  readonly formId?:string;
}

interface ModelCandidate {
  readonly category: string;
  readonly filename: string;
}

function normalizedForm(formId: string | undefined): string {
  return (formId ?? "base").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
    for (const candidate of this.candidates(request)) {
      const key=`${candidate.category}/${candidate.filename}`;
      const cached=this.cache.get(key);
      if(cached)return cached.clone(true);

      const inFlight=this.pending.get(key);
      if(inFlight){
        const model=await inFlight;
        if(model)return model.clone(true);
        continue;
      }

      const promise=this.fetchModel(candidate,key);
      this.pending.set(key,promise);
      const model=await promise;
      if(model)return model.clone(true);
    }
    return null;
  }

  private candidates(request:PokemonModelRequest):readonly ModelCandidate[] {
    const dex=String(request.nationalDex);
    const form=normalizedForm(request.formId);
    const genderSuffix=request.gender==="male" ? "-M" : request.gender==="female" ? "-F" : null;
    const result:ModelCandidate[]=[];
    const add=(category:string,filename:string):void=>{
      if(!result.some(candidate=>candidate.category===category&&candidate.filename===filename)){
        result.push({category,filename});
      }
    };

    const formAliases:string[]=[];
    if(form!=="base"){
      if(form.includes("mega")) formAliases.push("mega");
      if(form.includes("gigantamax")||form==="gmax") formAliases.push("gmax");
      if(form.includes("alolan")||form.includes("alola")) formAliases.push("alolan");
      if(form.includes("galarian")||form.includes("galar")) formAliases.push("galarian");
      if(form.includes("hisuian")||form.includes("hisui")) formAliases.push("hisuian");
      if(form.includes("primal")) formAliases.push("primal");
      if(form.includes("origin")) formAliases.push("origin");
    }

    for(const alias of formAliases){
      if(request.shiny)add(`shiny-${alias}`,dex);
      add(alias,dex);
      if(genderSuffix){ if(request.shiny)add(`shiny-${alias}`,`${dex}${genderSuffix}`); add(alias,`${dex}${genderSuffix}`); }
    }

    if(form!=="base"){
      if(request.shiny)add("multi",`${form}-${dex}`);
      add("multi",`${form}-${dex}`);
      if(request.shiny)add("special",`${form}-${dex}`);
      add("special",`${form}-${dex}`);
    }

    if(request.shiny){
      if(genderSuffix)add("shiny",`${dex}${genderSuffix}`);
      add("shiny",dex);
    }
    if(genderSuffix)add("regular",`${dex}${genderSuffix}`);
    add("regular",dex);

    return result;
  }

  private async fetchModel(candidate:ModelCandidate,key:string):Promise<THREE.Group|null>{
    try{
      const url=`https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/${candidate.category}/${candidate.filename}.glb`;
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
