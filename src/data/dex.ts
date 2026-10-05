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

export async function loadDex(generation:Generation):Promise<DexPayload>{
  const response=await fetch(`/api/dex?generation=${generation}`);
  if(!response.ok) throw new Error(`Dex request failed: ${response.status}`);
  return await response.json() as DexPayload;
}

export function initialPokemon(species:DexSpecies, level=50):PokemonBattleState{
  const abilityId=Object.values(species.abilities)[0] ?? "";
  const gender:Gender=species.gender==="N"?"genderless":species.gender==="F"?"female":"male";
  const hp = Math.floor(((2 * (species.baseStats.hp ?? 1) + 31) * level) / 100) + level + 10;
  return {id:"player",speciesId:species.id,formId:species.forme?.toLowerCase()||"base",gender,shiny:false,level,abilityId,heldItemId:null,hp,maxHp:hp,status:null,moves:[]};
}

export function toMoveSlots(moves:readonly DexMove[]):readonly MoveSlot[]{
  return moves.slice(0,4).map(move=>({moveId:move.id,pp:move.pp,maxPp:move.pp}));
}


export async function loadLearnset(generation: Generation, speciesId: string): Promise<readonly string[]> {
  const response = await fetch(`/api/learnset?generation=${generation}&species=${encodeURIComponent(speciesId)}`);
  if (!response.ok) throw new Error(`Learnset request failed: ${response.status}`);
  const data = await response.json() as {moves: string[]};
  return data.moves;
}
