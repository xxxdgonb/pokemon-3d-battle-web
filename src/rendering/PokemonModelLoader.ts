import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
  readonly formId?:string;
  readonly speciesName?:string;
}

interface ModelCandidate { readonly category:string; readonly filename:string; }

function normalizedForm(formId:string|undefined):string {
  return (formId??"base").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export class PokemonModelLoader {
  private readonly loader=new GLTFLoader();
  private readonly draco=new DRACOLoader();
  private readonly cache=new Map<string,THREE.Group>();
  private readonly pending=new Map<string,Promise<THREE.Group|null>>();

  public constructor(){
    this.draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    this.loader.setDRACOLoader(this.draco);
  }

  public async load(request:PokemonModelRequest):Promise<THREE.Group|null>{
    for(const candidate of this.candidates(request)){
      const key=`${candidate.category}/${candidate.filename}`;
      const cached=this.cache.get(key);
      if(cached)return SkeletonUtils.clone(cached) as THREE.Group;
      const inFlight=this.pending.get(key);
      if(inFlight){
        const model=await inFlight;
        if(model)return SkeletonUtils.clone(model) as THREE.Group;
        continue;
      }
      const promise=this.fetchModel(candidate,key);
      this.pending.set(key,promise);
      const model=await promise;
      if(model)return SkeletonUtils.clone(model) as THREE.Group;
    }
    return null;
  }

  private candidates(request:PokemonModelRequest):readonly ModelCandidate[]{
    const dex=String(request.nationalDex);
    const form=normalizedForm(request.formId);
    const suffix=request.gender==="male"?"-M":request.gender==="female"?"-F":null;
    const result:ModelCandidate[]=[];
    const add=(category:string,filename:string):void=>{
      if(!filename)return;
      if(!result.some(x=>x.category===category&&x.filename===filename))result.push({category,filename});
    };
    const variants=(value:string|undefined):string[]=>{
      if(!value || value==="base")return [];
      const normalized=value.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
      const words=normalized.split("-").filter(Boolean);
      const pascal=words.map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join("");
      const underscored=words.map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join("_");
      return [...new Set([value,normalized,normalized.replace(/-/g,""),pascal,underscored])];
    };
    const addVariants=(category:string,values:readonly string[]):void=>{
      for(const value of values)for(const filename of variants(value))add(category,filename);
    };

    if(form!=="base"){
      if(form.includes("mega-x")) {
        if(request.shiny)add("sx",dex);
        add("x",dex);
      } else if(form.includes("mega-y")) {
        if(request.shiny)add("sy",dex);
        add("y",dex);
      } else if(form.includes("mega")){
        if(request.shiny)add("megaShiny",dex);
        add("mega",dex);
      } else if(form.includes("gigantamax")||form==="gmax"){
        add("gmax",dex);
      } else if(form.includes("alolan")||form==="alola"){
        add("alolan",dex);
      } else if(form.includes("galarian")||form==="galar"){
        add("galar",dex);
      } else if(form.includes("hisuian")||form==="hisui"){
        add("hisuian",dex);
      } else if(form.includes("primal")){
        add("primal",dex);
      } else if(form.includes("origin")){
        add("origin",dex);
      } else if(form.includes("fusion")){
        const names=[form,request.speciesName].filter((value):value is string=>Boolean(value));
        if(request.shiny)addVariants("fusionShiny",names);
        addVariants("fusion",names);
      } else {
        const names=[form,request.speciesName].filter((value):value is string=>Boolean(value));
        if(request.shiny)addVariants("multiShinyForm",names);
        addVariants("multiform",names);
        if(request.shiny)addVariants("unique",names);
        addVariants("unique",names);
      }
    }

    if(request.shiny && suffix)add("shiny",`${dex}${suffix}`);
    if(request.shiny)add("shiny",dex);
    if(suffix)add("regular",`${dex}${suffix}`);
    add("regular",dex);
    return result;
  }

  private async fetchModel(candidate:ModelCandidate,key:string):Promise<THREE.Group|null>{
    try{
      const url=`https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/${candidate.category}/${candidate.filename}.glb`;
      const gltf=await this.loader.loadAsync(url);
      gltf.scene.userData.animationClips=gltf.animations;
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
