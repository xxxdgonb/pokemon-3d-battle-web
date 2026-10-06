import type { Generation, Gender, PokemonBattleState } from "../core/types";
import { loadDex, loadLearnset, initialPokemon, calculateHp, normalizeId, toMoveSlots, type DexMove, type DexPayload, type DexSpecies } from "../data/dex";
import { RemoteShowdownAdapter } from "../battle/RemoteShowdownAdapter";
import { WebSocketShowdownTransport } from "../battle/WebSocketShowdownTransport";
import { BattlePresentationCoordinator } from "../battle/BattlePresentationCoordinator";
import { ThreeBattleRenderer } from "../rendering/ThreeBattleRenderer";

type Stage="menu"|"generation"|"pokemon"|"details"|"form"|"gender"|"shiny"|"ability"|"item"|"level"|"moves"|"battle";

export class App {
  private stage:Stage="menu";
  private generation:Generation=9;
  private dex:DexPayload|null=null;
  private species:DexSpecies|null=null;
  private selectedMoves:DexMove[]=[];
  private legalMoveIds:readonly string[]=[];
  private pokemon:PokemonBattleState|null=null;
  private opponentPokemon:PokemonBattleState|null=null;
  private opponentSpecies:DexSpecies|null=null;
  private coordinator:BattlePresentationCoordinator|null=null;
  private adapter:RemoteShowdownAdapter|null=null;
  private readonly root:HTMLElement;
  private battleRenderer:ThreeBattleRenderer|null=null;
  private moveBusy=false;
  private battleEnded=false;
  private battleResult:"VICTORY"|"DEFEAT"|null=null;

  public constructor(root:HTMLElement){this.root=root;this.render();}

  private async chooseGeneration(g:Generation):Promise<void>{
    this.generation=g; this.dex=await loadDex(g); this.stage="pokemon"; this.render();
  }

  private async selectSpecies(s:DexSpecies):Promise<void>{
    this.species=s; this.pokemon=initialPokemon(s); this.selectedMoves=[];
    this.legalMoveIds=await loadLearnset(this.generation,s.id);
    this.stage="details"; this.render();
  }

  private render():void{
    if(this.stage==="battle"){this.renderBattle();return;}
    this.root.innerHTML=`<main class="app-shell"><section class="panel"><div class="eyebrow">POKÉMON 3D BATTLE</div><h1>${this.title()}</h1><div id="content"></div></section></main>`;
    const c=this.root.querySelector("#content") as HTMLElement;
    if(this.stage==="menu") c.innerHTML='<button data-action="start">Start Battle</button>';
    if(this.stage==="generation") c.innerHTML=this.generations();
    if(this.stage==="pokemon") c.innerHTML=this.speciesList();
    if(this.stage==="details") c.innerHTML=this.details();
    if(this.stage==="form") c.innerHTML=this.form();
    if(this.stage==="gender") c.innerHTML=this.gender();
    if(this.stage==="shiny") c.innerHTML=this.shiny();
    if(this.stage==="ability") c.innerHTML=this.ability();
    if(this.stage==="item") c.innerHTML=this.item();
    if(this.stage==="level") c.innerHTML=this.level();
    if(this.stage==="moves") c.innerHTML=this.moves();
    c.querySelectorAll<HTMLElement>("[data-action]").forEach(el=>el.addEventListener("click",()=>void this.action(el.dataset.action??"",el.dataset.value)));
  }

  private speciesIdForForm(s:DexSpecies):string{
    return s.id;
  }

  private formIdForForm(s:DexSpecies):string{
    return s.forme ? s.forme.toLowerCase().replace(/[^a-z0-9]+/g,"-") : "base";
  }

  private title():string{return ({menu:"Battle",generation:"Generation",pokemon:"Pokémon",details:"Details",form:"Form",gender:"Gender",shiny:"Shiny",ability:"Ability",item:"Held Item",level:"Level",moves:"Moves"} as Record<string,string>)[this.stage]??"Battle";}

  private generations():string{return Array.from({length:9},(_,i)=>i+1).map(g=>`<button data-action="generation" data-value="${g}">Generation ${g}</button>`).join("");}

  private speciesList():string{
    const list=this.dex?.species.filter(s=>s.baseSpecies===s.name || !s.forme).slice(0,1025)??[];
    return `<div class="grid-list">${list.map(s=>`<button data-action="species" data-value="${s.id}">#${s.num} ${s.name}</button>`).join("")}</div>`;
  }

  private details():string{
    const s=this.species!; return `<p>Types: ${s.types.join(" / ")}</p><p>Base stats: ${Object.entries(s.baseStats).map(([k,v])=>`${k} ${v}`).join(" · ")}</p><button data-action="next">Continue</button>`;
  }

  private form():string{
    const forms=this.dex?.species.filter(s=>s.baseSpecies===this.species!.baseSpecies)??[];
    return `<div class="grid-list">${forms.map(s=>`<button data-action="form" data-value="${s.id}">${s.name}</button>`).join("")}</div>`;
  }

  private gender():string{
    const rule=this.species?.gender;
    const genders=rule==="M"?["male"]:rule==="F"?["female"]:rule==="N"?["genderless"]:["male","female"];
    return genders.map(g=>`<button data-action="gender" data-value="${g}">${g}</button>`).join("");
  }
  private shiny():string{return '<button data-action="shiny" data-value="false">Normal</button><button data-action="shiny" data-value="true">Shiny</button>';}
  private ability():string{
    const abilityIds=new Set(Object.values(this.species!.abilities).map(normalizeId));
    const a=this.dex?.abilities.filter(x=>abilityIds.has(x.id))??[];
    return a.map(x=>`<button data-action="ability" data-value="${x.id}">${x.name}</button>`).join("")||'<button data-action="next">Default Ability</button>';
  }
  private item():string{
    return `<button data-action="item" data-value="">No Item</button><div class="grid-list">${(this.dex?.items??[]).map(x=>`<button data-action="item" data-value="${x.id}">${x.name}</button>`).join("")}</div>`;
  }
  private level():string{return '<input id="level" type="number" min="1" max="100" value="50"><button data-action="level">Continue</button>';}
  private moves():string{
    const moves=this.dex?.moves.filter(m=>this.legalMoveIds.includes(m.id))??[];
    return `<p>Select 4 moves: ${this.selectedMoves.length}/4</p><div class="grid-list">${moves.map(m=>`<button data-action="move" data-value="${m.id}">${m.name} · ${m.type} · ${m.category}</button>`).join("")}</div><button data-action="battle" ${this.selectedMoves.length===4?"":"disabled"}>Enter Battle</button>`;
  }

  private async action(action:string,value?:string):Promise<void>{
    if(action==="start"){this.stage="generation";this.render();return;}
    if(action==="generation"){await this.chooseGeneration(Number(value) as Generation);return;}
    if(action==="species"){const s=this.dex?.species.find(x=>x.id===value);if(s)await this.selectSpecies(s);return;}
    if(action==="next"){this.stage=this.nextStage();this.render();return;}
    if(action==="form"){
      const s=this.dex?.species.find(x=>x.id===value);
      if(s){
        this.species=s;
        this.legalMoveIds=await loadLearnset(this.generation,s.id);
        const gender:Gender=s.gender==="N"?"genderless":s.gender==="F"?"female":"male";
        if(this.pokemon)this.pokemon={...this.pokemon,speciesId:this.speciesIdForForm(s),formId:this.formIdForForm(s),abilityId:normalizeId(Object.values(s.abilities)[0]??""),gender};
        this.stage="gender";
        this.render();
      }
      return;
    }
    if(action==="gender"){if(this.pokemon)this.pokemon={...this.pokemon,gender:value as Gender};this.stage="shiny";this.render();return;}
    if(action==="shiny"){if(this.pokemon)this.pokemon={...this.pokemon,shiny:value==="true"};this.stage="ability";this.render();return;}
    if(action==="ability"){if(this.pokemon)this.pokemon={...this.pokemon,abilityId:value??""};this.stage="item";this.render();return;}
    if(action==="item"){if(this.pokemon)this.pokemon={...this.pokemon,heldItemId:value||null};this.stage="level";this.render();return;}
    if(action==="level"){const input=this.root.querySelector<HTMLInputElement>("#level");const level=Math.max(1,Math.min(100,Number(input?.value)||50));if(this.pokemon&&this.species){const hp=calculateHp(this.species,level);this.pokemon={...this.pokemon,level,hp,maxHp:hp};}this.stage="moves";this.render();return;}
    if(action==="move"){const m=this.dex?.moves.find(x=>x.id===value);if(!m)return;if(this.selectedMoves.some(x=>x.id===m.id))this.selectedMoves=this.selectedMoves.filter(x=>x.id!==m.id);else if(this.selectedMoves.length<4)this.selectedMoves=[...this.selectedMoves,m];this.render();return;}
    if(action==="battle" && this.selectedMoves.length===4){await this.startBattle();return;}
  }

  private nextStage():Stage{return this.stage==="details"?"form":"generation";}

  private async startBattle():Promise<void>{
    const debug=(value:string):void=>{if(new URLSearchParams(window.location.search).get("browserSmoke")==="1")document.body.dataset.battleDebug=value;};
    debug("start");
    if(!this.pokemon||!this.dex)return;
    this.pokemon={...this.pokemon,moves:toMoveSlots(this.selectedMoves)};
    this.battleEnded=false;
    const charizard=this.dex.species.find(s=>s.id==="charizard" || s.baseSpecies==="Charizard");
    if(!charizard)throw new Error("Charizard is unavailable in the selected generation.");
    debug("enemy-learnset");
    const enemyLearnset=await loadLearnset(this.generation,charizard.id);
    debug("enemy-learnset-ready");
    const enemyMoves=enemyLearnset.map(id=>this.dex!.moves.find(m=>m.id===id)).filter((m):m is DexMove=>Boolean(m)).slice(0,4);
    if(enemyMoves.length<1)throw new Error("No legal passive-opponent moves are available.");
    const opponent={
      ...this.pokemon,
      id:"opponent",
      speciesId:this.speciesIdForForm(charizard),
      formId:this.formIdForForm(charizard),
      abilityId:normalizeId(Object.values(charizard.abilities)[0]??""),
      heldItemId:null,
      moves:toMoveSlots(enemyMoves),
    };
    this.opponentPokemon=opponent;
    this.opponentSpecies=charizard;
    this.adapter=new RemoteShowdownAdapter(new WebSocketShowdownTransport());
    debug("adapter-create");
    await this.adapter.createBattle({generation:this.generation,player:this.pokemon,opponent});
    debug("adapter-ready");
    this.coordinator=new BattlePresentationCoordinator(await this.adapter.getState());
    this.coordinator.initializeBattle();
    debug("render-battle");
    this.stage="battle";
    this.render();
  }

  private renderBattle():void{
    this.root.innerHTML='<section id="battle-root" class="battle-screen"><div id="battle-canvas" class="battle-canvas"></div><div class="battle-hud"><div><strong>Player</strong><div class="hpbar"><i id="player-hpbar"></i></div><span id="player-hp"></span><small id="player-status"></small></div><div><strong>Opponent</strong><div class="hpbar"><i id="opponent-hpbar"></i></div><span id="opponent-hp"></span><small id="opponent-status"></small></div><div id="moves" class="move-grid"></div></div></section>';
    const host=this.root.querySelector("#battle-canvas") as HTMLElement;
    this.battleRenderer=new ThreeBattleRenderer(host);
    void this.battleRenderer.setupBattle({nationalDex:this.species!.num,shiny:this.pokemon!.shiny,gender:this.pokemon!.gender,formId:this.pokemon!.formId},{nationalDex:this.opponentSpecies!.num,shiny:this.opponentPokemon!.shiny,gender:this.opponentPokemon!.gender,formId:this.opponentPokemon!.formId},this.generation).catch(error=>console.error("3D battle setup failed",error));
    const moves=this.selectedMoves;
    const container=this.root.querySelector("#moves") as HTMLElement;
    moves.forEach(m=>{const b=document.createElement("button");b.textContent=`${m.name} · ${m.type} · ${m.category} · PP ${m.pp} · Power ${m.basePower || "—"} · Acc ${m.accuracy === true ? "—" : m.accuracy}`;b.disabled=this.battleEnded;b.onclick=()=>void this.useMove(m);container.appendChild(b);});
    if(this.battleEnded){
      const result=this.battleResult==="VICTORY"?"Victory!":"Defeat!";
      const panel=document.createElement("div");
      panel.className="battle-result";
      panel.innerHTML=`<strong>${result}</strong><button data-action="restart-battle">Battle Again</button>`;
      panel.querySelector("button")?.addEventListener("click",()=>void this.resetBattle());
      this.root.querySelector(".battle-hud")?.appendChild(panel);
    }
    this.updateBattleHud();
  }

  private async useMove(m:DexMove):Promise<void>{
    if(this.moveBusy||this.battleEnded||!this.adapter||!this.coordinator)return;
    this.moveBusy=true;
    this.root.querySelectorAll<HTMLButtonElement>(".move-grid button").forEach(button=>button.disabled=true);
    const id=`tx-${Date.now()}-${m.id}`;
    try{
      this.coordinator.selectMove(m.id);
      this.coordinator.startMove(id,m.id);
      let resolved=false;
      const resolveOnce=():void=>{if(resolved)return;resolved=true;void this.resolveMove(id,m);};
      if(this.battleRenderer)void this.battleRenderer.playMove(m.type,resolveOnce);
      else window.setTimeout(resolveOnce,0);
      window.setTimeout(resolveOnce,1800);
    }catch(error){
      this.moveBusy=false;
      if(!this.battleEnded)this.root.querySelectorAll<HTMLButtonElement>(".move-grid button").forEach(button=>button.disabled=false);
      console.error(error);
      await this.resetBattle();
    }
  }

  private async resolveMove(id:string,m:DexMove):Promise<void>{
    if(!this.adapter||!this.coordinator)return;
    try{
      this.coordinator.markAnimationImpact(id);
      const events=await this.adapter.submitPlayerMove(m.id);
      this.coordinator.syncAuthoritativeState(await this.adapter.getState());
      this.coordinator.applyAuthoritativeResolution(id,events);
      this.updateBattleHud();
      this.coordinator.resolveSecondaryEffects(id,events);
      this.coordinator.processStatus(id);
      const state=this.coordinator.finishTransaction(id,this.coordinator.state.player.hp<=0,this.coordinator.state.opponent.hp<=0);
      if(state.phase==="VICTORY"||state.phase==="DEFEAT"){
        this.battleEnded=true;
        this.battleResult=state.phase;
        this.coordinator.endBattle();
        this.updateBattleHud();
        this.root.querySelectorAll<HTMLButtonElement>(".move-grid button").forEach(button=>button.disabled=true);
        const hud=this.root.querySelector(".battle-hud");
        if(hud&&!hud.querySelector(".battle-result")){
          const panel=document.createElement("div");
          panel.className="battle-result";
          panel.innerHTML=`<strong>${this.battleResult==="VICTORY"?"Victory!":"Defeat!"}</strong><button data-action="restart-battle">Battle Again</button>`;
          panel.querySelector("button")?.addEventListener("click",()=>void this.resetBattle());
          hud.appendChild(panel);
        }
        return;
      }
    }catch(error){
      console.error(error);
      alert(error instanceof Error?error.message:"Battle move failed.");
      await this.resetBattle();
    }finally{
      this.moveBusy=false;
      if(!this.battleEnded)this.root.querySelectorAll<HTMLButtonElement>(".move-grid button").forEach(button=>button.disabled=false);
    }
  }

  private updateBattleHud():void{
    if(!this.coordinator)return;
    const s=this.coordinator.state;
    const p=this.root.querySelector("#player-hp"); const o=this.root.querySelector("#opponent-hp");
    if(p)p.textContent=`HP ${s.player.hp}/${s.player.maxHp}`;
    if(o)o.textContent=`HP ${s.opponent.hp}/${s.opponent.maxHp}`;
    const pb=this.root.querySelector<HTMLElement>("#player-hpbar"); const ob=this.root.querySelector<HTMLElement>("#opponent-hpbar");
    if(pb)pb.style.width=`${Math.max(0,100*s.player.hp/Math.max(1,s.player.maxHp))}%`;
    if(ob)ob.style.width=`${Math.max(0,100*s.opponent.hp/Math.max(1,s.opponent.maxHp))}%`;
    const ps=this.root.querySelector("#player-status"); const os=this.root.querySelector("#opponent-status");
    if(ps)ps.textContent=s.player.status ? `Status: ${s.player.status}` : "";
    if(os)os.textContent=s.opponent.status ? `Status: ${s.opponent.status}` : "";
  }
  private async resetBattle():Promise<void>{
    await this.adapter?.dispose();
    this.adapter=null;
    this.coordinator=null;
    this.battleRenderer?.dispose();
    this.battleRenderer=null;
    this.pokemon=null;
    this.opponentPokemon=null;
    this.opponentSpecies=null;
    this.species=null;
    this.selectedMoves=[];
    this.legalMoveIds=[];
    this.moveBusy=false;
    this.battleEnded=false;
    this.battleResult=null;
    this.stage="menu";
    this.render();
  }
}


