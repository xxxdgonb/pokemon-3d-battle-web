import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export interface PokemonModelRequest {
  readonly nationalDex:number;
  readonly shiny:boolean;
  readonly gender:"male"|"female"|"genderless";
  readonly formId?:string;
  readonly speciesName?:string; readonly heightm?:number | undefined;
}

interface ModelCandidate { readonly category:string; readonly filename:string; }

function normalizedForm(formId:string|undefined):string {
  return (formId??"base").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export class PokemonModelLoader {
  private readonly loader=new GLTFLoader();
  private readonly textureLoader=new THREE.TextureLoader();
  private readonly draco=new DRACOLoader();
  private readonly cache=new Map<string,THREE.Group>();
  private readonly pending=new Map<string,Promise<THREE.Group|null>>();
  private readonly fallbackInstances=new Set<THREE.Group>();

  public constructor(){
    this.draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    this.loader.setDRACOLoader(this.draco);
  }

  public async load(request:PokemonModelRequest):Promise<THREE.Group|null>{
    for(const candidate of this.candidates(request)){
      const key=`${candidate.category}/${candidate.filename}`;
      const cached=this.cache.get(key);
      if(cached)return this.cloneWithAnimations(cached);
      const inFlight=this.pending.get(key);
      if(inFlight){
        const model=await inFlight;
        if(model)return this.cloneWithAnimations(model);
        continue;
      }
      const promise=this.fetchModel(candidate,key);
      this.pending.set(key,promise);
      const model=await promise;
      if(model)return this.cloneWithAnimations(model);
    }
    // The public 3D catalog is not complete for every form/shiny variant.
    // Never leave the battle arena empty: use a lit 3D billboard fallback
    // backed by PokeAPI HOME artwork when no GLB can be resolved.
    return this.createArtworkFallback(request);
  }

  private async createArtworkFallback(request:PokemonModelRequest):Promise<THREE.Group|null>{
    const id=String(request.nationalDex);
    const variant=request.shiny?"shiny/":"";
    const url=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${variant}${id}.png`;
    try{
      const texture=await this.textureLoader.loadAsync(url);
      texture.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
      const sprite=new THREE.Sprite(material);
      const worldHeight=Math.max(.65,Math.min(3.25,(request.heightm??1.2)*1.05));
      sprite.scale.set(worldHeight,worldHeight,1);
      sprite.position.y=worldHeight*.5;
      const group=new THREE.Group();
      group.add(sprite);
      group.userData.artworkFallback=true;
      group.userData.artworkSource=url;
      this.fallbackInstances.add(group);
      return group;
    }catch{
      return null;
    }
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
    const multiFormFiles:Record<string,string>={
      deoxysattack:"386-1",deoxysdefense:"386-2",deoxysspeed:"386-3",
      zygarde10:"718_1",zygarde50:"718_2",zygardecomplete:"718_3",
      rotomfan:"RotomFan",rotomfrost:"RotomFrost",rotomheat:"RotomHeat",rotommow:"RotomMow",
      lycanrocdusk:"LycanrocDuskForm",lycanrocmidnight:"LycanrocMidnightForm",
      shayminsky:"ShayminSky",wishiwashischool:"WishiwashiSchool",basculinbluestripe:"BasculinBlueStripe",
      enamorustherian:"EnamorusTherian",koraidoncombat:"Koraidon_Combat",koraidondrive:"Koraidon_Drive",
      miraidonaquatic:"Miraidon_Aquatic"
    };
    const addKnownMultiForm=(category:string):void=>{
      const keys=[form,request.speciesName??""]
        .map(value=>value.toLowerCase().replace(/[^a-z0-9]+/g,""));
      for(const keyName of keys){
        const filename=multiFormFiles[keyName];
        if(filename){add(category,filename);break;}
      }
    };

    if(form!=="base"){
      if(form.includes("mega-x")) {
        if(request.shiny)add("sx",dex);
        if(!request.shiny)add("x",dex);
      } else if(form.includes("mega-y")) {
        if(request.shiny)add("sy",dex);
        if(!request.shiny)add("y",dex);
      } else if(form.includes("mega")){
        if(request.shiny)add("megaShiny",dex);
        if(!request.shiny)add("mega",dex);
      } else if(form.includes("gigantamax")||form==="gmax"){
        if(!request.shiny)add("gmax",dex);
      } else if(form.includes("alolan")||form==="alola"){
        if(!request.shiny)add("alolan",dex);
      } else if(form.includes("galarian")||form==="galar"){
        if(!request.shiny)add("galar",dex);
      } else if(form.includes("hisuian")||form==="hisui"){
        if(!request.shiny)add("hisuian",dex);
      } else if(form.includes("primal")){
        if(!request.shiny)add("primal",dex);
      } else if(form.includes("origin")){
        if(!request.shiny)add("origin",dex);
      } else if(form.includes("fusion")){
        const names=[form,request.speciesName].filter((value):value is string=>Boolean(value));
        if(request.shiny)addVariants("fusionShiny",names);
        if(!request.shiny)addVariants("fusion",names);
      } else {
        const names=[form,request.speciesName].filter((value):value is string=>Boolean(value));
        if(request.shiny)addVariants("multiShinyForm",names);
        if(!request.shiny){addKnownMultiForm("multiform");addVariants("multiform",names);}
        if(request.shiny)addVariants("unique",names);
        if(!request.shiny)addVariants("unique",names);
      }
    }

    if(request.shiny && suffix)add("shiny",`${dex}${suffix}`);
    if(request.shiny)add("shiny",dex);
    // Do not silently replace a requested shiny appearance with a normal
    // model. If the shiny GLB is unavailable, load the shiny artwork fallback
    // below so the visual identity remains correct.
    if(!request.shiny){
      if(suffix)add("regular",`${dex}${suffix}`);
      add("regular",dex);
    }
    return result;
  }

  /**
   * SkeletonUtils.clone() deep-copies userData. AnimationClip/KeyframeTrack
   * instances are class objects with methods, so putting them in userData
   * causes those methods to be lost during cloning and leads to:
   * "tracks[i].createInterpolant is not a function".
   * Keep the real clips on the cached source and explicitly reattach them
   * after cloning.
   */
  private cloneWithAnimations(source:THREE.Group):THREE.Group{
    const clone=SkeletonUtils.clone(source) as THREE.Group;
    const clips=source.userData.animationClips as THREE.AnimationClip[]|undefined;
    if(clips?.length)clone.userData.animationClips=clips;
    return clone;
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

  public disposeInstance(model:THREE.Group):void{
    if(!this.fallbackInstances.has(model))return;
    this.fallbackInstances.delete(model);
    model.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(mesh.geometry)mesh.geometry.dispose();
      const material=mesh.material;
      if(Array.isArray(material)){
        material.forEach(item=>{(item as THREE.MeshStandardMaterial).map?.dispose();item.dispose();});
      }else if(material){
        (material as THREE.MeshStandardMaterial).map?.dispose();
        material.dispose();
      }
    });
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
    for(const model of [...this.fallbackInstances])this.disposeInstance(model);
    this.fallbackInstances.clear();
    this.draco.dispose();
  }
}
