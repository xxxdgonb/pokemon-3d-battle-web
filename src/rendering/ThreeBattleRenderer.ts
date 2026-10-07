import * as THREE from "three";
import { AnimationController } from "../animation/AnimationController";
import { MoveAnimationController } from "../animation/MoveAnimationController";
import { EffectsRenderer } from "../effects/EffectsRenderer";
import { CameraController } from "./CameraController";
import { PokemonModelLoader } from "./PokemonModelLoader";
import type { ShowdownBattleEvent } from "../battle/ShowdownAdapter";
import { summarizeBattleEvents } from "../battle/BattleEventJournal";

export class ThreeBattleRenderer {
  public readonly scene=new THREE.Scene();
  public readonly camera=new THREE.PerspectiveCamera(42,1,0.1,1000);
  public readonly renderer:THREE.WebGLRenderer;
  private readonly loader=new PokemonModelLoader();
  private readonly cameraController:CameraController;
  private readonly effects:EffectsRenderer;
  private readonly animations=new AnimationController();
  private readonly moveAnimations=new MoveAnimationController(this.animations);
  private playerModel:THREE.Group|null=null;
  private opponentModel:THREE.Group|null=null;
  private animationFrame:number|null=null;
  private disposed=false;

  public constructor(private readonly host:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.setSize(host.clientWidth||1,host.clientHeight||1,false);
    this.renderer.shadowMap.enabled=true;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.cameraController=new CameraController(this.camera);
    this.effects=new EffectsRenderer(this.scene);
    window.addEventListener("resize",this.handleResize);
    this.scene.background=new THREE.Color(0x0b1220);
    const hemi=new THREE.HemisphereLight(0xddeeff,0x223344,2); this.scene.add(hemi);
    const key=new THREE.DirectionalLight(0xffffff,2.5); key.position.set(5,10,7); key.castShadow=true; this.scene.add(key);
    this.createArena();
    if(new URLSearchParams(window.location.search).get("browserSmoke")!=="1")this.animate();
  }

  private createArena():void{
    const ground=new THREE.Mesh(new THREE.CircleGeometry(12,64),new THREE.MeshStandardMaterial({color:0x274b32,roughness:1}));
    ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; this.scene.add(ground);
    for(const z of [-3.5,3.5]){
      const ring=new THREE.Mesh(new THREE.RingGeometry(2.1,2.3,64),new THREE.MeshStandardMaterial({color:0xb8c7d9,roughness:.8}));
      ring.rotation.x=-Math.PI/2; ring.position.z=z; ring.position.y=.015; this.scene.add(ring);
    }
  }

  public async setupBattle(player:{nationalDex:number;shiny:boolean;gender:"male"|"female"|"genderless";formId?:string;speciesName?:string},opponent:{nationalDex:number;shiny:boolean;gender:"male"|"female"|"genderless";formId?:string;speciesName?:string},generation:number):Promise<void>{
    void generation;
    if(this.playerModel){this.animations.dispose(this.playerModel);this.scene.remove(this.playerModel);}
    if(this.opponentModel){this.animations.dispose(this.opponentModel);this.scene.remove(this.opponentModel);}
    this.playerModel=await this.loader.load(player);
    this.opponentModel=await this.loader.load(opponent);
    if(!this.playerModel)this.showModelUnavailable("Player model unavailable");
    if(!this.opponentModel)this.showModelUnavailable("Opponent model unavailable");
    if(this.playerModel){this.playerModel.position.set(-2,0,2.7);this.playerModel.rotation.y=Math.PI;this.playerModel.scale.setScalar(1.5);this.addModel(this.playerModel);}
    if(this.opponentModel){this.opponentModel.position.set(2,0,-2.5);this.opponentModel.scale.setScalar(1.5);this.addModel(this.opponentModel);}
    this.cameraController.set("default");
    this.render();
  }

  private showModelUnavailable(message:string):void{
    const existing=this.host.querySelector(".model-unavailable"); if(existing)return;
    const label=document.createElement("div"); label.className="model-unavailable"; label.textContent=message;
    label.style.cssText="position:absolute;top:12px;left:12px;padding:6px 10px;background:#111c;color:#fff;border:1px solid #789;border-radius:8px;font:12px system-ui;z-index:2";
    this.host.appendChild(label);
  }

  private addModel(model:THREE.Group):void{
    model.traverse(o=>{const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}); this.scene.add(model);
  }

  public async playResolution(type:string,events:readonly ShowdownBattleEvent[],moveId?:string):Promise<void>{
    const summary=summarizeBattleEvents(events);
    const modelFor=(side:"player"|"opponent"):THREE.Group|null=>side==="player"?this.playerModel:this.opponentModel;
    const hitSides=[...new Set(summary.damage.map(event=>event.target))];
    for(const side of hitSides){
      const target=modelFor(side);
      if(!target)continue;
      this.effects.playTypeImpact(type,target,moveId);
      await this.animations.play(target,"hit",220);
    }
    for(const side of summary.fainted){
      const target=modelFor(side);
      if(target)await this.animations.play(target,"faint",520);
    }
  }
  public async playMove(type:string,onImpact:()=>void,moveId?:string):Promise<void>{
    const model=this.playerModel;
    const target=this.opponentModel;
    this.cameraController.set("move");
    if(!model){onImpact();return;}
    let impacted=false;
    const triggerImpact=():void=>{
      if(impacted)return;
      impacted=true;
      this.cameraController.set("impact");
      onImpact();
    };
    const projectile=target?this.effects.playProjectile(type,model,target,triggerImpact,moveId):Promise.resolve().then(triggerImpact);
    await Promise.all([
      this.moveAnimations.play({actor:model,target,onImpact:triggerImpact}),
      projectile,
    ]);
    this.cameraController.set("default");
  }

  private readonly handleResize=():void=>{this.resize();};

  public resize():void{
    const width=Math.max(this.host.clientWidth,1),height=Math.max(this.host.clientHeight,1);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);
  }
  public render():void{this.renderer.render(this.scene,this.camera);}
  private lastFrame=performance.now();
  private animate=():void=>{
    if(this.disposed)return;
    const now=performance.now();
    const delta=Math.min(.05,(now-this.lastFrame)/1000);
    this.lastFrame=now;
    this.cameraController.update(delta);
    this.animations.update(delta);
    this.render();
    this.animationFrame=requestAnimationFrame(this.animate);
  };
  public dispose():void{
    if(this.disposed)return; this.disposed=true;
    if(this.animationFrame!==null)cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize",this.handleResize);
    if(this.playerModel){this.animations.dispose(this.playerModel);this.scene.remove(this.playerModel);}
    if(this.opponentModel){this.animations.dispose(this.opponentModel);this.scene.remove(this.opponentModel);}
    this.playerModel=null;
    this.opponentModel=null;
    this.effects.dispose(); this.loader.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
