import type { Generation, Gender, PokemonBattleState } from "../core/types";
import { loadDex, loadLearnset, initialPokemon, calculateHp, normalizeId, toMoveSlots, type DexMove, type DexPayload, type DexSpecies } from "../data/dex";
import { RemoteShowdownAdapter } from "../battle/RemoteShowdownAdapter";
import { WebSocketShowdownTransport } from "../battle/WebSocketShowdownTransport";
import { BattlePresentationCoordinator } from "../battle/BattlePresentationCoordinator";
import { ThreeBattleRenderer } from "../rendering/ThreeBattleRenderer";
import { AudioManager } from "../audio/AudioManager";
import type { ShowdownBattleEvent } from "../battle/ShowdownAdapter";

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
  private loading=false;
  private errorMessage:string|null=null;
  private battle3dLoading=false;
  private battle3dError:string|null=null;
  private searchQuery="";
  private levelDraft=50;
  private readonly battleLog:string[]=[];
  private readonly audio=new AudioManager();

  public constructor(root:HTMLElement){
    this.root=root;
    this.root.addEventListener("click",(event)=>{
      const target=(event.target as HTMLElement|null)?.closest<HTMLElement>("[data-action]");
      if(!target || target.hasAttribute("disabled"))return;
      void this.action(target.dataset.action??"",target.dataset.value);
    });
    this.root.addEventListener("input",(event)=>{
      const target=event.target as HTMLInputElement|null;
      if(!target)return;
      if(target.dataset.search==="true"){
        this.searchQuery=target.value;
        const caret=target.selectionStart??target.value.length;
        this.render();
        const next=this.root.querySelector<HTMLInputElement>("[data-search=\"true\"]");
        if(next){next.focus();next.setSelectionRange(caret,caret);}
        return;
      }
      if(target.id==="level"){
        this.levelDraft=Math.max(1,Math.min(100,Number(target.value)||50));
        const label=this.root.querySelector("#level-value");
        if(label)label.textContent=String(this.levelDraft);
      }
    });
    this.render();
  }

  private async chooseGeneration(g:Generation):Promise<void>{
    if(this.loading)return;
    this.loading=true;
    this.errorMessage=null;
    this.generation=g;
    this.dex=null;
    this.species=null;
    this.selectedMoves=[];
    this.legalMoveIds=[];
    this.searchQuery="";
    this.render();
    try{
      this.dex=await loadDex(g);
      this.stage="pokemon";
    }catch(error){
      this.errorMessage=error instanceof Error?error.message:"Unable to load generation data.";
      this.stage="generation";
    }finally{
      this.loading=false;
      this.render();
    }
  }

  private async selectSpecies(s:DexSpecies):Promise<void>{
    this.species=s;
    this.pokemon=initialPokemon(s);
    this.selectedMoves=[];
    this.levelDraft=50;
    this.searchQuery="";
    this.legalMoveIds=await loadLearnset(this.generation,s.id);
    this.stage="details";
    this.render();
  }

  private render():void{
    if(this.stage==="battle"){this.renderBattle();return;}
    this.root.innerHTML=`<main class="app-shell"><section class="panel"><div class="eyebrow">POKÉMON 3D BATTLE</div><div class="topline"><div><h1>${this.title()}</h1><p class="subtitle">Generation ${this.generation} · Server-authoritative Showdown battle</p></div>${this.stage!=="menu"?'<button class="ghost-button" type="button" data-action="back">Back</button>':""}</div><div class="progress-dots" aria-label="Setup progress">${this.progressDots()}</div><div id="content"></div></section></main>`;
    const c=this.root.querySelector("#content") as HTMLElement;
    if(this.loading){
      c.innerHTML='<div class="loading-state" role="status"><div class="spinner" aria-hidden="true"></div><strong>Loading…</strong><p>Connecting to the local Showdown data service.</p></div>';
      return;
    }
    if(this.errorMessage){
      c.innerHTML=`<div class="error-state" role="alert"><strong>Unable to continue</strong><p>${this.escapeHtml(this.errorMessage)}</p><div class="choice-actions"><button type="button" data-action="retry-generation" data-value="${this.generation}">Retry Generation ${this.generation}</button><button class="ghost-button" type="button" data-action="back">Back</button></div></div>`;
      return;
    }
    if(this.stage==="menu")c.innerHTML=this.menu();
    if(this.stage==="generation")c.innerHTML=this.generations();
    if(this.stage==="pokemon")c.innerHTML=this.speciesList();
    if(this.stage==="details")c.innerHTML=this.details();
    if(this.stage==="form")c.innerHTML=this.form();
    if(this.stage==="gender")c.innerHTML=this.gender();
    if(this.stage==="shiny")c.innerHTML=this.shiny();
    if(this.stage==="ability")c.innerHTML=this.ability();
    if(this.stage==="item")c.innerHTML=this.item();
    if(this.stage==="level")c.innerHTML=this.level();
    if(this.stage==="moves")c.innerHTML=this.moves();
  }

  private menu():string{
    return `<div class="hero-card"><div><span class="hero-kicker">FULL BATTLE CLIENT</span><h2>Build a Pokémon and enter a real 3D battle.</h2><p>Generation-specific Showdown data, four legal moves, authoritative results, and a passive opponent with no AI decision-making.</p></div><button class="primary-button" type="button" data-action="start">Start Battle</button></div><div class="feature-grid"><div><strong>GEN 1–9</strong><span>Generation-specific Dex</span></div><div><strong>4 MOVES</strong><span>Learnset filtered</span></div><div><strong>SHOWDOWN</strong><span>Authoritative rules</span></div><div><strong>3D ARENA</strong><span>Three.js presentation</span></div></div>`;
  }

  private escapeHtml(value:string):string{
    return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]??char));
  }

  private title():string{
    return ({menu:"Battle Setup",generation:"Choose Generation",pokemon:"Choose Pokémon",details:"Pokémon Details",form:"Choose Form",gender:"Choose Gender",shiny:"Choose Appearance",ability:"Choose Ability",item:"Held Item",level:"Choose Level",moves:"Choose Moves"} as Record<string,string>)[this.stage]??"Battle";
  }

  private progressDots():string{
    const stages:Stage[]=["generation","pokemon","details","form","gender","shiny","ability","item","level","moves"];
    const current=this.stage==="menu"?0:Math.max(1,stages.indexOf(this.stage)+1);
    return Array.from({length:10},(_,i)=>`<i class="${i<current?"active":""}" aria-hidden="true"></i>`).join("");
  }

  private generations():string{
    return `<div class="section-intro"><div><strong>Select a generation</strong><span>All nine generations use their own Showdown species, items and learnsets.</span></div></div><div class="generation-grid" role="list">${Array.from({length:9},(_,i)=>i+1).map(g=>`<button type="button" role="listitem" data-action="generation" data-value="${g}"><strong>GEN ${g}</strong><small>Generation ${g}</small></button>`).join("")}</div>`;
  }

  private speciesList():string{
    const query=this.searchQuery.trim().toLowerCase();
    const all=this.dex?.species.filter(s=>s.baseSpecies===s.name||!s.forme)??[];
    const list=all.filter(s=>!query||s.name.toLowerCase().includes(query)||s.id.includes(query)||String(s.num)===query).slice(0,150);
    return `<div class="section-intro"><div><strong>Choose your Pokémon</strong><span>${all.length} base species · Search by name or Pokédex number.</span></div></div><label class="search-field"><span>Search Pokémon</span><input data-search="true" type="search" placeholder="Pikachu, Charizard, 025…" value="${this.escapeHtml(this.searchQuery)}" autocomplete="off"></label>${list.length?`<div class="grid-list pokemon-grid">${list.map(s=>`<button class="pokemon-card" type="button" data-action="species" data-value="${s.id}"><strong>#${String(s.num).padStart(3,"0")} · ${this.escapeHtml(s.name)}</strong><span>${s.types.join(" / ")}</span><small>HP ${s.baseStats.hp} · ATK ${s.baseStats.atk} · DEF ${s.baseStats.def}</small></button>`).join("")}</div>`:'<div class="empty-state">No Pokémon match your search.</div>'}`;
  }

  private details():string{
    const s=this.species!;
    const stats=Object.entries(s.baseStats).map(([k,v])=>`<div><span>${k.toUpperCase()}</span><strong>${v}</strong></div>`).join("");
    return `<div class="selected-card"><div><span class="badge">${s.types.join(" / ")}</span><h2>#${String(s.num).padStart(3,"0")} ${this.escapeHtml(s.name)}</h2><p>Choose the battle identity next: form, gender, shiny status, ability, held item and level.</p></div><div class="stat-grid">${stats}</div></div><div class="choice-actions"><button type="button" data-action="next">Continue to Form</button></div>`;
  }

  private form():string{
    const base=this.species!.baseSpecies;
    const forms=this.dex?.species.filter(s=>s.baseSpecies===base).filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i)??[];
    if(forms.length<=1)return `<div class="empty-state"><strong>${this.escapeHtml(this.species!.name)}</strong><span>No alternate forms are registered.</span></div><div class="choice-actions"><button type="button" data-action="next">Continue</button></div>`;
    const query=this.searchQuery.trim().toLowerCase();
    const filtered=forms.filter(s=>!query||s.name.toLowerCase().includes(query)||s.id.includes(query));
    return `<div class="section-intro"><div><strong>Choose a form</strong><span>${forms.length} forms available for ${this.escapeHtml(base)}.</span></div></div><label class="search-field"><span>Search form</span><input data-search="true" type="search" placeholder="Search forms…" value="${this.escapeHtml(this.searchQuery)}" autocomplete="off"></label><div class="grid-list option-grid">${filtered.map(s=>`<button class="option-card" type="button" data-action="form" data-value="${s.id}"><strong>${this.escapeHtml(s.name)}</strong><span>${s.types.join(" / ")} · ${s.isMega?"Mega":s.isGigantamax?"Gigantamax":"Standard"}</span></button>`).join("")}</div>`;
  }

  private gender():string{
    const rule=this.species?.gender;
    const genders=rule==="M"?["male"]:rule==="F"?["female"]:rule==="N"?["genderless"]:["male","female"];
    return `<div class="section-intro"><div><strong>Choose gender</strong><span>Available choices follow the selected species data.</span></div></div><div class="option-grid">${genders.map(g=>`<button class="option-card" type="button" data-action="gender" data-value="${g}"><strong>${g.charAt(0).toUpperCase()+g.slice(1)}</strong><span>${g==="genderless"?"Genderless species":"Battle identity"}</span></button>`).join("")}</div>`;
  }

  private shiny():string{
    return `<div class="section-intro"><div><strong>Choose appearance</strong><span>Shiny is preserved as part of the Pokémon identity.</span></div></div><div class="option-grid"><button class="option-card" type="button" data-action="shiny" data-value="false"><strong>Normal</strong><span>Standard appearance</span></button><button class="option-card" type="button" data-action="shiny" data-value="true"><strong>Shiny</strong><span>Alternate appearance</span></button></div>`;
  }

  private ability():string{
    const abilityIds=new Set(Object.values(this.species!.abilities).map(normalizeId));
    const abilities=this.dex?.abilities.filter(x=>abilityIds.has(x.id))??[];
    return `<div class="section-intro"><div><strong>Choose ability</strong><span>${abilities.length||1} legal choice${abilities.length===1?"":"s"}.</span></div></div><div class="option-grid">${abilities.map(x=>`<button class="option-card" type="button" data-action="ability" data-value="${x.id}"><strong>${this.escapeHtml(x.name)}</strong><span>${this.escapeHtml(x.shortDesc||"Ability effect from Showdown.")}</span></button>`).join("")||'<button class="option-card" type="button" data-action="next"><strong>Default Ability</strong><span>Use the species default.</span></button>'}</div>`;
  }

  private item():string{
    const query=this.searchQuery.trim().toLowerCase();
    const items=(this.dex?.items??[]).filter(x=>!query||x.name.toLowerCase().includes(query)||x.id.includes(query)).slice(0,120);
    return `<div class="section-intro"><div><strong>Choose held item</strong><span>Optional. Search the current generation item pool.</span></div></div><div class="choice-actions"><button class="option-card selected" type="button" data-action="item" data-value=""><strong>No Item</strong><span>Battle without a held item.</span></button></div><label class="search-field"><span>Search item</span><input data-search="true" type="search" placeholder="Leftovers, Choice, Life Orb…" value="${this.escapeHtml(this.searchQuery)}" autocomplete="off"></label><div class="grid-list compact-grid">${items.map(x=>`<button class="option-card" type="button" data-action="item" data-value="${x.id}"><strong>${this.escapeHtml(x.name)}</strong><span>${this.escapeHtml(x.shortDesc||"Held item")}</span></button>`).join("")}</div>`;
  }

  private level():string{
    const level=this.levelDraft;
    return `<div class="level-card"><label for="level"><span>Battle level</span><strong id="level-value">${level}</strong></label><input id="level" type="range" min="1" max="100" value="${level}"><div class="level-scale"><span>1</span><span>50</span><span>100</span></div></div><div class="choice-actions"><button type="button" data-action="level">Continue to Moves</button></div>`;
  }

  private moves():string{
    const query=this.searchQuery.trim().toLowerCase();
    const moves=this.dex?.moves.filter(m=>this.legalMoveIds.includes(m.id)).filter(m=>!query||m.name.toLowerCase().includes(query)||m.id.includes(query)||m.type.toLowerCase().includes(query)).slice(0,180)??[];
    return `<div class="section-intro"><div><strong>Choose four moves</strong><span>${this.selectedMoves.length}/4 selected · Only legal learnset moves are shown.</span></div></div><div class="selected-moves">${this.selectedMoves.map((m,i)=>`<button class="selected-move" type="button" data-action="move" data-value="${m.id}"><span>#${i+1}</span><strong>${this.escapeHtml(m.name)}</strong><small>PP ${m.pp} · ${m.type}</small></button>`).join("")||'<div class="empty-state">Select four moves below.</div>'}</div><label class="search-field"><span>Search move</span><input data-search="true" type="search" placeholder="Thunderbolt, Fire, status…" value="${this.escapeHtml(this.searchQuery)}" autocomplete="off"></label><div class="grid-list move-picker">${moves.map(m=>{const selected=this.selectedMoves.some(x=>x.id===m.id);return `<button class="option-card ${selected?"selected":""}" type="button" data-action="move" data-value="${m.id}" ${!selected&&this.selectedMoves.length>=4?"disabled":""}><strong>${this.escapeHtml(m.name)}</strong><span>${m.type} · ${m.category} · Power ${m.basePower||"—"} · Acc ${m.accuracy===true?"—":m.accuracy}</span><small>PP ${m.pp} · Priority ${m.priority>=0?"+":""}${m.priority}</small></button>`;}).join("")}</div><div class="choice-actions"><button class="primary-button" type="button" data-action="battle" ${this.selectedMoves.length===4?"":"disabled"}>Enter 3D Battle</button></div>`;
  }

  private async action(action:string,value?:string):Promise<void>{
    try{
      if(action==="start"){this.errorMessage=null;this.searchQuery="";this.stage="generation";this.render();return;}
      if(action==="retry-generation"){await this.chooseGeneration(Number(value) as Generation);return;}
      if(action==="back"){this.goBack();return;}
      if(action==="generation"){await this.chooseGeneration(Number(value) as Generation);return;}
      if(action==="species"){
        if(this.loading)return;
        const s=this.dex?.species.find(x=>x.id===value);
        if(s){
          this.loading=true;this.errorMessage=null;this.render();
          try{await this.selectSpecies(s);}
          catch(error){this.errorMessage=error instanceof Error?error.message:"Unable to load Pokémon data.";this.stage="pokemon";}
          finally{this.loading=false;this.render();}
        }
        return;
      }
      if(action==="next"){
        const next=this.nextStage();
        if(next){this.searchQuery="";this.stage=next;this.render();}
        return;
      }
      if(action==="form"){
        const s=this.dex?.species.find(x=>x.id===value);
        if(s){
          this.species=s;
          this.legalMoveIds=await loadLearnset(this.generation,s.id);
          const gender:Gender=s.gender==="N"?"genderless":s.gender==="F"?"female":"male";
          if(this.pokemon)this.pokemon={...this.pokemon,speciesId:s.id,formId:formIdForForm(s),abilityId:normalizeId(Object.values(s.abilities)[0]??""),gender};
          this.searchQuery="";this.stage="gender";this.render();
        }
        return;
      }
      if(action==="gender"){if(this.pokemon)this.pokemon={...this.pokemon,gender:value as Gender};this.stage="shiny";this.render();return;}
      if(action==="shiny"){if(this.pokemon)this.pokemon={...this.pokemon,shiny:value==="true"};this.stage="ability";this.render();return;}
      if(action==="ability"){if(this.pokemon)this.pokemon={...this.pokemon,abilityId:value??""};this.stage="item";this.searchQuery="";this.render();return;}
      if(action==="item"){if(this.pokemon)this.pokemon={...this.pokemon,heldItemId:value||null};this.stage="level";this.render();return;}
      if(action==="level"){
        const level=Math.max(1,Math.min(100,this.levelDraft));
        if(this.pokemon&&this.species){const hp=calculateHp(this.species,level);this.pokemon={...this.pokemon,level,hp,maxHp:hp};}
        this.stage="moves";this.searchQuery="";this.render();return;
      }
      if(action==="move"){
        const m=this.dex?.moves.find(x=>x.id===value);if(!m)return;
        if(this.selectedMoves.some(x=>x.id===m.id))this.selectedMoves=this.selectedMoves.filter(x=>x.id!==m.id);
        else if(this.selectedMoves.length<4)this.selectedMoves=[...this.selectedMoves,m];
        this.render();return;
      }
      if(action==="battle"&&this.selectedMoves.length===4){await this.startBattle();return;}
      if(action==="retry-3d"){await this.retry3D();return;}
      if(action==="restart-battle"){await this.resetBattle();return;}
    }catch(error){
      this.errorMessage=error instanceof Error?error.message:"Unexpected application error.";
      this.appendBattleLog(`ERROR: ${this.errorMessage}`);
      console.error(error);
      if(this.stage==="battle")this.updateBattleHud();else this.render();
    }
  }

  private goBack():void{
    const previous:Partial<Record<Stage,Stage>>={generation:"menu",pokemon:"generation",details:"pokemon",form:"details",gender:"form",shiny:"gender",ability:"shiny",item:"ability",level:"item",moves:"level"};
    const target=previous[this.stage];
    if(target){this.errorMessage=null;this.searchQuery="";this.stage=target;this.render();}
  }

  private nextStage():Stage|null{
    const next:Partial<Record<Stage,Stage>>={details:"form",form:"gender",gender:"shiny",shiny:"ability",ability:"item",item:"level",level:"moves"};
    return next[this.stage]??null;
  }

  private async startBattle():Promise<void>{
    const player=this.pokemon;
    const dex=this.dex;
    const chosenSpecies=this.species;
    if(!player||!dex||!chosenSpecies)return;
    this.pokemon={...player,moves:toMoveSlots(this.selectedMoves)};
    const configuredPlayer=this.pokemon;
    this.battleEnded=false;this.battleResult=null;this.battleLog.length=0;this.battle3dError=null;this.battle3dLoading=true;
    const charizard=dex.species.find(s=>s.id==="charizard"||(s.baseSpecies==="Charizard"&&!s.forme));
    if(!charizard)throw new Error("Charizard is unavailable in the selected generation.");
    const enemyLearnset=await loadLearnset(this.generation,charizard.id);
    const enemyMoves=enemyLearnset.map(id=>dex.moves.find(m=>m.id===id)).filter((m):m is DexMove=>Boolean(m)).slice(0,4);
    if(enemyMoves.length<1)throw new Error("No legal passive-opponent moves are available.");
    const enemyLevel=player.level;
    const enemyHp=calculateHp(charizard,enemyLevel);
    const opponent:PokemonBattleState={...initialPokemon(charizard,enemyLevel),id:"opponent",speciesId:charizard.id,formId:formIdForForm(charizard),gender:this.genderForSpecies(charizard),shiny:false,abilityId:normalizeId(Object.values(charizard.abilities)[0]??""),heldItemId:null,hp:enemyHp,maxHp:enemyHp,moves:toMoveSlots(enemyMoves)};
    this.opponentPokemon=opponent;this.opponentSpecies=charizard;
    const battleOpponent=opponent;
    const battleOpponentSpecies=charizard;
    this.appendBattleLog(`Battle created · ${chosenSpecies.name} vs ${battleOpponentSpecies.name} · Lv.${enemyLevel}`);
    const adapter=new RemoteShowdownAdapter(new WebSocketShowdownTransport());
    this.adapter=adapter;
    try{
      await adapter.createBattle({generation:this.generation,player:configuredPlayer,opponent:battleOpponent});
      this.coordinator=new BattlePresentationCoordinator(await adapter.getState());
      this.coordinator.initializeBattle();
      this.stage="battle";
      this.renderBattle();
      const renderer=this.battleRenderer;
      if(renderer){
        try{
          await renderer.setupBattle(
            {nationalDex:chosenSpecies.num,shiny:configuredPlayer.shiny,gender:configuredPlayer.gender,formId:configuredPlayer.formId,speciesName:chosenSpecies.name},
            {nationalDex:battleOpponentSpecies.num,shiny:battleOpponent.shiny,gender:battleOpponent.gender,formId:battleOpponent.formId,speciesName:battleOpponentSpecies.name},
            this.generation
          );
        }catch(error){
          this.battle3dError=error instanceof Error?error.message:"3D renderer failed to initialize.";
          this.appendBattleLog(`3D: ${this.battle3dError}`);
        }
      }
    }catch(error){
      this.adapter=null;this.coordinator=null;
      await adapter.dispose();
      throw error;
    }finally{
      this.battle3dLoading=false;
      this.updateBattleHud();
    }
  }

  private renderBattle():void{
    if(this.battleRenderer)this.battleRenderer.dispose();
    this.battleRenderer=null;
    this.root.innerHTML='<section id="battle-root" class="battle-screen"><div id="battle-canvas" class="battle-canvas"></div><div class="battle-topbar"><div><strong>3D BATTLE</strong><span id="turn-label">Turn 1</span></div><button class="ghost-button" type="button" data-action="restart-battle">Exit Battle</button></div><div class="battle-hud"><div class="combatant-card"><div class="combatant-head"><strong id="player-name">Player</strong><span id="player-level"></span></div><div class="hpbar"><i id="player-hpbar"></i></div><div class="hp-readout"><span id="player-hp"></span><small id="player-status"></small></div></div><div class="combatant-card"><div class="combatant-head"><strong id="opponent-name">Opponent</strong><span id="opponent-level"></span></div><div class="hpbar"><i id="opponent-hpbar"></i></div><div class="hp-readout"><span id="opponent-hp"></span><small id="opponent-status"></small></div></div><div class="battle-log" id="battle-log"></div><div id="moves" class="move-grid"></div><div class="battle-result-slot" id="battle-result-slot"></div></div><div id="battle-loading" class="battle-overlay"></div></section>';
    const host=this.root.querySelector("#battle-canvas") as HTMLElement;
    this.battleRenderer=new ThreeBattleRenderer(host);
    for(const move of this.selectedMoves){
      const button=document.createElement("button");
      button.type="button";
      button.dataset.moveId=move.id;
      button.onclick=()=>void this.useMove(move);
      (this.root.querySelector("#moves") as HTMLElement).appendChild(button);
    }
    this.updateBattleHud();
  }

  private refreshBattleControls():void{
    const container=this.root.querySelector("#moves") as HTMLElement|null;
    if(!container)return;
    const state=this.coordinator?.state;
    for(const button of Array.from(container.querySelectorAll<HTMLButtonElement>("button"))){
      const moveId=button.dataset.moveId??"";
      const slot=state?.player.moves.find(m=>m.moveId===moveId);
      const local=this.selectedMoves.find(m=>m.id===moveId);
      const pp=slot?.pp??local?.pp??0;
      const maxPp=slot?.maxPp??local?.pp??1;
      button.textContent=`${local?.name??moveId} · ${local?.type??""} · PP ${pp}/${maxPp} · Power ${local?.basePower||"—"} · Acc ${local?.accuracy===true?"—":local?.accuracy}`;
      button.disabled=this.moveBusy||this.battleEnded||this.battle3dLoading||pp<=0;
      button.title=pp<=0?"No PP remaining":this.battle3dLoading?"Preparing 3D presentation…":"Use move";
    }
  }

  private updateBattleHud():void{
    if(!this.coordinator)return;
    const s=this.coordinator.state;
    const p=this.root.querySelector("#player-hp");const o=this.root.querySelector("#opponent-hp");
    if(p)p.textContent=`HP ${s.player.hp}/${s.player.maxHp}`;
    if(o)o.textContent=`HP ${s.opponent.hp}/${s.opponent.maxHp}`;
    const pb=this.root.querySelector<HTMLElement>("#player-hpbar");const ob=this.root.querySelector<HTMLElement>("#opponent-hpbar");
    if(pb)pb.style.width=`${Math.max(0,100*s.player.hp/Math.max(1,s.player.maxHp))}%`;
    if(ob)ob.style.width=`${Math.max(0,100*s.opponent.hp/Math.max(1,s.opponent.maxHp))}%`;
    const ps=this.root.querySelector("#player-status");const os=this.root.querySelector("#opponent-status");
    if(ps)ps.textContent=s.player.status?`Status: ${s.player.status}`:"";
    if(os)os.textContent=s.opponent.status?`Status: ${s.opponent.status}`:"";
    const pn=this.root.querySelector("#player-name");const on=this.root.querySelector("#opponent-name");
    if(pn)pn.textContent=this.species?.name??"Player";
    if(on)on.textContent=this.opponentSpecies?.name??"Opponent";
    const pl=this.root.querySelector("#player-level");const ol=this.root.querySelector("#opponent-level");
    if(pl)pl.textContent=`Lv.${s.player.level}`;if(ol)ol.textContent=`Lv.${s.opponent.level}`;
    const turn=this.root.querySelector("#turn-label");if(turn)turn.textContent=`Turn ${Math.max(1,s.turn)}`;
    this.refreshBattleControls();this.renderBattleLog();
    const overlay=this.root.querySelector("#battle-loading") as HTMLElement|null;
    if(overlay){
      if(this.battle3dLoading)overlay.innerHTML='<div class="battle-loader"><div class="spinner"></div><strong>Preparing 3D arena…</strong><span>Battle rules are active; presentation is loading.</span></div>';
      else if(this.battle3dError)overlay.innerHTML=`<div class="battle-loader"><strong>3D model unavailable</strong><span>${this.escapeHtml(this.battle3dError)}</span><button type="button" data-action="retry-3d">Retry 3D</button></div>`;
      else overlay.innerHTML="";
    }
    const slot=this.root.querySelector("#battle-result-slot") as HTMLElement|null;
    if(slot)slot.innerHTML=this.battleEnded?`<div class="battle-result"><div><strong>${this.battleResult==="VICTORY"?"Victory!":"Defeat!"}</strong><span>Authoritative battle ended.</span></div><button type="button" data-action="restart-battle">Battle Again</button></div>`:"";
  }

  private renderBattleLog():void{
    const log=this.root.querySelector("#battle-log");
    if(!log)return;
    log.innerHTML=this.battleLog.slice(-7).map(line=>`<div>${this.escapeHtml(line)}</div>`).join("")||"<div>Choose a move to begin.</div>";
    log.scrollTop=log.scrollHeight;
  }

  private appendBattleLog(line:string):void{
    this.battleLog.push(line);
    if(this.battleLog.length>40)this.battleLog.shift();
  }

  private async useMove(m:DexMove):Promise<void>{
    if(this.moveBusy||this.battleEnded||!this.adapter||!this.coordinator||this.battle3dLoading)return;
    const current=this.coordinator.state.player.moves.find(slot=>slot.moveId===m.id);
    if(current&&current.pp<=0)return;
    this.moveBusy=true;this.audio.play("move");this.refreshBattleControls();
    const id=`tx-${Date.now()}-${m.id}`;
    try{
      this.coordinator.selectMove(m.id);this.coordinator.startMove(id,m.id);
      let resolved=false;
      const resolveOnce=():void=>{
        if(resolved)return;
        resolved=true;
        void this.resolveMove(id,m).catch(error=>{
          this.appendBattleLog(`Battle error: ${error instanceof Error?error.message:"Unknown error"}`);
          this.moveBusy=false;
          this.updateBattleHud();
        });
      };
      if(this.battleRenderer){
        void this.battleRenderer.playMove(m.type,resolveOnce).catch(error=>{
          this.appendBattleLog(`3D animation error: ${error instanceof Error?error.message:"Unknown error"}`);
          resolveOnce();
        });
      }else window.setTimeout(resolveOnce,0);
      window.setTimeout(resolveOnce,1800);
    }catch(error){
      this.moveBusy=false;this.refreshBattleControls();this.appendBattleLog(`Battle error: ${error instanceof Error?error.message:"Unknown error"}`);throw error;
    }
  }

  private async resolveMove(id:string,m:DexMove):Promise<void>{
    if(!this.adapter||!this.coordinator)return;
    try{
      this.coordinator.markAnimationImpact(id);
      const events=await this.adapter.submitPlayerMove(m.id);
      this.coordinator.syncAuthoritativeState(await this.adapter.getState());
      this.coordinator.applyAuthoritativeResolution(id,events);
      await this.battleRenderer?.playResolution(m.type,events);
      if(events.some(event=>event.kind==="damage"))this.audio.play("impact");
      if(events.some(event=>event.kind==="status"||event.kind==="curestatus"))this.audio.play("status");
      if(events.some(event=>event.kind==="faint"))this.audio.play("faint");
      this.appendResolutionLog(m,events);this.updateBattleHud();
      this.coordinator.resolveSecondaryEffects(id,events);this.coordinator.processStatus(id);
      const state=this.coordinator.finishTransaction(id,this.coordinator.state.player.hp<=0,this.coordinator.state.opponent.hp<=0);
      if(state.phase==="VICTORY"||state.phase==="DEFEAT"){
        this.battleEnded=true;this.battleResult=state.phase;this.audio.play(state.phase==="VICTORY"?"victory":"defeat");this.coordinator.endBattle();this.appendBattleLog(state.phase==="VICTORY"?"Battle won.":"Battle lost.");this.updateBattleHud();return;
      }
      this.updateBattleHud();
    }catch(error){
      this.appendBattleLog(`Battle error: ${error instanceof Error?error.message:"Unknown error"}`);
      this.updateBattleHud();
    }finally{
      this.moveBusy=false;this.refreshBattleControls();
    }
  }

  private appendResolutionLog(move:DexMove,events:readonly ShowdownBattleEvent[]):void{
    const damage=events.filter(e=>e.kind==="damage").length;
    const crit=events.some(e=>e.kind==="crit");
    const miss=events.some(e=>e.kind==="miss");
    const immune=events.some(e=>e.kind==="immune");
    const failed=events.some(e=>e.kind==="failed");
    if(miss)this.appendBattleLog(`${move.name} missed.`);
    else if(immune)this.appendBattleLog(`${move.name} had no effect.`);
    else if(failed)this.appendBattleLog(`${move.name} failed.`);
    else if(damage>0)this.appendBattleLog(`${this.species?.name??"Player"} used ${move.name} · ${crit?"Critical hit · ":""}Opponent HP ${this.coordinator?.state.opponent.hp??0}/${this.coordinator?.state.opponent.maxHp??0}.`);
    else this.appendBattleLog(`${this.species?.name??"Player"} used ${move.name}.`);
    if(events.some(e=>e.kind==="status"))this.appendBattleLog("A status condition was applied.");
    if(events.some(e=>e.kind==="boost"||e.kind==="unboost"))this.appendBattleLog("A stat stage changed.");
    if(events.some(e=>e.kind==="ability"||e.kind==="item"||e.kind==="enditem"))this.appendBattleLog("An ability or item effect activated.");
    if(events.some(e=>e.kind==="faint"))this.appendBattleLog("A Pokémon fainted.");
  }

  private async retry3D():Promise<void>{
    if(!this.battleRenderer||!this.species||!this.opponentSpecies||!this.pokemon||!this.opponentPokemon)return;
    this.battle3dLoading=true;this.battle3dError=null;this.updateBattleHud();
    try{
      await this.battleRenderer.setupBattle(
        {nationalDex:this.species.num,shiny:this.pokemon.shiny,gender:this.pokemon.gender,formId:this.pokemon.formId,speciesName:this.species.name},
        {nationalDex:this.opponentSpecies.num,shiny:this.opponentPokemon.shiny,gender:this.opponentPokemon.gender,formId:this.opponentPokemon.formId,speciesName:this.opponentSpecies.name},
        this.generation
      );
    }catch(error){
      this.battle3dError=error instanceof Error?error.message:"3D renderer failed to initialize.";
      this.appendBattleLog(`3D: ${this.battle3dError}`);
    }finally{
      this.battle3dLoading=false;this.updateBattleHud();
    }
  }

  private genderForSpecies(s:DexSpecies):Gender{return s.gender==="N"?"genderless":s.gender==="F"?"female":"male";}

  private async resetBattle():Promise<void>{
    const adapter=this.adapter;const renderer=this.battleRenderer;
    this.adapter=null;this.coordinator=null;this.battleRenderer=null;
    await adapter?.dispose();renderer?.dispose();
    this.pokemon=null;this.opponentPokemon=null;this.opponentSpecies=null;this.species=null;this.selectedMoves=[];this.legalMoveIds=[];
    this.moveBusy=false;this.battleEnded=false;this.battleResult=null;this.battle3dLoading=false;this.battle3dError=null;this.battleLog.length=0;this.searchQuery="";this.levelDraft=50;this.stage="menu";this.render();
  }
}

function formIdForForm(s:DexSpecies):string{
  return s.forme?s.forme.toLowerCase().replace(/[^a-z0-9]+/g,"-"):"base";
}
