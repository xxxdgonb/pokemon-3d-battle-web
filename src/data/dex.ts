import type { Generation, Gender, MoveSlot, PokemonBattleState } from "../core/types";

export interface DexSpecies {
  readonly id:string; readonly name:string; readonly num:number; readonly baseSpecies:string;
  readonly forme?:string; readonly types:readonly string[]; readonly abilities:Record<string,string>;
  readonly gender?:string; readonly genderRatio?:Record<string,number>; readonly isMega?:boolean;
  readonly isGigantamax?:boolean; readonly gen?:number; readonly baseStats:Record<string,number>;
}
export interface DexMove {
  readonly id:string; readonly name:string; readonly type:string; readonly category:string;
  readonly basePower:number; readonly accuracy:number|true; readonly pp:number; readonly priority:number;
  readonly target:string; readonly desc:string; readonly gen:number;
}
export interface DexNamed {readonly id:string; readonly name:string; readonly shortDesc:string; readonly gen:number;}
export interface DexPayload {readonly generation:Generation; readonly species:readonly DexSpecies[]; readonly moves:readonly DexMove[]; readonly abilities:readonly DexNamed[]; readonly items:readonly DexNamed[];}

export function normalizeId(value:string):string{
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"");
}

export async function loadDex(generation:Generation):Promise<DexPayload>{
  if(!Number.isInteger(generation) || generation<1 || generation>9) throw new Error("Invalid generation. Choose Generation 1-9.");
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`/api/dex?generation=${generation}`,{signal:controller.signal,cache:"no-store"});
    const contentType=response.headers.get("content-type")??"";
    if(!response.ok){
      let detail="";
      try{detail=(await response.text()).slice(0,240)}catch{}
      throw new Error(`Dex request failed (${response.status})${detail ? `: ${detail}` : "."}`);
    }
    if(!contentType.includes("application/json")) throw new Error("Dex API returned non-JSON data. Start the Showdown runtime with npm run dev.");
    const payload=await response.json() as DexPayload;
    if(payload.generation!==generation || !Array.isArray(payload.species) || payload.species.length===0){
      throw new Error(`Generation ${generation} returned invalid Pokémon data.`);
    }
    return payload;
  }catch(error){
    if(error instanceof DOMException && error.name==="AbortError") throw new Error("Dex request timed out. Make sure the development server is running.");
    throw error;
  }finally{
    window.clearTimeout(timeout);
  }
}

export function calculateHp(species:DexSpecies, level:number):number {
  return Math.floor(((2 * (species.baseStats.hp ?? 1) + 31) * level) / 100) + level + 10;
}

export function initialPokemon(species:DexSpecies, level=50):PokemonBattleState{
  const abilityId=normalizeId(Object.values(species.abilities)[0] ?? "");
  const gender:Gender=species.gender==="N"?"genderless":species.gender==="F"?"female":"male";
  const hp = calculateHp(species, level);
  return {id:"player",speciesId:species.id,formId:species.forme?.toLowerCase()||"base",gender,shiny:false,level,abilityId,heldItemId:null,hp,maxHp:hp,status:null,moves:[]};
}

export function toMoveSlots(moves:readonly DexMove[]):readonly MoveSlot[]{
  return moves.slice(0,4).map(move=>({moveId:move.id,pp:move.pp,maxPp:move.pp}));
}


export async function loadLearnset(generation: Generation, speciesId: string): Promise<readonly string[]> {
  if (!Number.isInteger(generation) || generation < 1 || generation > 9) {
    throw new Error("Invalid generation for learnset.");
  }
  if (!/^[a-z0-9-]+$/i.test(speciesId)) throw new Error("Invalid Pokémon identifier.");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/learnset?generation=${generation}&species=${encodeURIComponent(speciesId)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.text()).slice(0, 240); } catch {}
      throw new Error(`Learnset request failed (${response.status})${detail ? `: ${detail}` : "."}`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error("Learnset API returned non-JSON data. Start the Showdown runtime with npm run dev.");
    }
    const data = await response.json() as {moves?: unknown};
    if (!Array.isArray(data.moves)) throw new Error("Learnset API returned invalid move data.");
    return data.moves.filter((move): move is string => typeof move === "string");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Learnset request timed out. Make sure the development server is running.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
