import type { BattleState, BattleSide, BattleStat, MoveSlot, PokemonBattleState, StatStages, StatusCondition } from "../core/types";
import type { ShowdownProtocolMessage } from "./ShowdownProtocol";

interface ShowdownRequestPokemon {
  readonly ident?: string; readonly condition?: string; readonly active?: boolean; readonly details?: string;
  readonly moves?: readonly string[]; readonly baseAbility?: string; readonly ability?: string;
}
interface ShowdownRequestActive { readonly moves?: readonly ShowdownRequestActiveMove[]; }
interface ShowdownRequestActiveMove { readonly move?: string; readonly id?: string; readonly pp?: number; readonly maxpp?: number; }
interface ShowdownRequest {
  readonly side?: { readonly id?: string; readonly pokemon?: readonly ShowdownRequestPokemon[] };
  readonly active?: readonly ShowdownRequestActive[];
}

const STAT_KEYS: readonly BattleStat[] = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];
const EMPTY_STAGES: StatStages = Object.fromEntries(STAT_KEYS.map(stat => [stat, 0])) as StatStages;

function sideFromIdent(ident: string): BattleSide | null {
  if (ident.startsWith("p1")) return "player";
  if (ident.startsWith("p2")) return "opponent";
  return null;
}

function parseCondition(condition: string | undefined): {hp: number; maxHp: number} | null {
  if (!condition) return null;
  const match = condition.match(/^(\d+)(?:\/(\d+))?/);
  if (!match) return null;
  const hp = Number(match[1]); const maxHp = match[2] === undefined ? hp : Number(match[2]);
  return Number.isFinite(hp) && Number.isFinite(maxHp) ? {hp, maxHp} : null;
}

function parseStatus(condition: string | undefined): StatusCondition {
  if (!condition) return null;
  const token = condition.split(" ")[1] ?? "";
  return ["brn", "par", "psn", "tox", "slp", "frz"].includes(token) ? token as StatusCondition : null;
}

function normalizeId(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

function updatePokemon(pokemon: PokemonBattleState, patch: Partial<PokemonBattleState>): PokemonBattleState {
  return {...pokemon, ...patch};
}

function updateSide(state: BattleState, side: BattleSide, patch: Partial<PokemonBattleState>): BattleState {
  const pokemon = side === "player" ? state.player : state.opponent;
  const next = updatePokemon(pokemon, patch);
  return side === "player" ? {...state, player: next} : {...state, opponent: next};
}

function parseRequestMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const raw = message.args[0]; if (!raw) return state;
  let request: ShowdownRequest;
  try { request = JSON.parse(raw) as ShowdownRequest; } catch { return state; }

  const sideId = request.side?.id;
  const side = sideId === "p1" ? "player" : sideId === "p2" ? "opponent" : null;
  if (!side) return state;

  const active = request.side?.pokemon?.find(pokemon => pokemon.active) ?? request.side?.pokemon?.[0];
  const condition = parseCondition(active?.condition);
  const status = parseStatus(active?.condition);
  const moves: readonly MoveSlot[] = (request.active?.[0]?.moves ?? [])
    .filter(move => typeof move.id === "string")
    .map(move => ({moveId: move.id!, pp: Number.isFinite(move.pp) ? move.pp! : 0, maxPp: Number.isFinite(move.maxpp) ? move.maxpp! : move.pp ?? 0}));

  const patch: {
    hp?: number; maxHp?: number; status?: StatusCondition; moves?: readonly MoveSlot[];
    abilityId?: string; speciesId?: string; formId?: string; gender?: PokemonBattleState["gender"]; shiny?: boolean;
    statStages?: StatStages; volatileConditions?: readonly string[];
  } = {};
  if (active?.details) {
    const parts = active.details.split(",").map(part => part.trim()).filter(Boolean);
    const rawName = parts[0];
    if (rawName) {
      const normalized = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const formMarker = normalized.match(/^(.*?)-(mega-x|mega-y|mega|gmax|gigantamax|alolan|galarian|hisuian|paldean)$/);
      patch.speciesId = formMarker?.[1] ?? normalized;
      patch.formId = formMarker?.[2] ?? "base";
    }
    const formName = parts[1];
    if (formName && !/^l\d+$/i.test(formName) && !["M", "F", "shiny"].includes(formName)) {
      patch.formId = formName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    const genderToken = parts.find(part => part === "M" || part === "F");
    if (genderToken === "M") patch.gender = "male";
    if (genderToken === "F") patch.gender = "female";
    if (parts.includes("shiny")) patch.shiny = true;
  }
  if (condition) { patch.hp = condition.hp; patch.maxHp = condition.maxHp; }
  if (active?.ability) patch.abilityId = normalizeId(active.ability);
  else if (active?.baseAbility) patch.abilityId = normalizeId(active.baseAbility);
  if (moves.length > 0) patch.moves = moves;
  patch.status = status;
  return updateSide(state, side, patch);
}

function parseHpMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0], condition = message.args[1];
  if (!target || !condition) return state;
  const side = sideFromIdent(target); if (!side) return state;
  const parsed = parseCondition(condition); if (!parsed) return state;
  return updateSide(state, side, {hp: Math.max(0, Math.min(parsed.maxHp, parsed.hp)), maxHp: parsed.maxHp});
}

function parseStatusMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0], status = message.args[1];
  const side = target ? sideFromIdent(target) : null;
  if (!side || !status) return state;
  const normalized = ["brn", "par", "psn", "tox", "slp", "frz"].includes(status) ? status as StatusCondition : null;
  return updateSide(state, side, {status: normalized});
}

function parseAbilityMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target=message.args[0], ability=message.args[1]; const side=target ? sideFromIdent(target) : null;
  return side && ability ? updateSide(state,side,{abilityId:normalizeId(ability)}) : state;
}

function parseItemMessage(state: BattleState, message: ShowdownProtocolMessage, clear:boolean): BattleState {
  const target=message.args[0], item=message.args[1]; const side=target ? sideFromIdent(target) : null;
  if(!side)return state;
  return updateSide(state,side,{heldItemId:clear?null:(item?normalizeId(item):null)});
}

function parseFaintMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0]; const side = target ? sideFromIdent(target) : null;
  return side ? updateSide(state, side, {hp: 0}) : state;
}

function parseStatToken(token: string): BattleStat | null {
  const map: Record<string, BattleStat> = {atk:"atk", def:"def", spa:"spa", spd:"spd", spe:"spe", accuracy:"accuracy", evasion:"evasion"};
  return map[token.toLowerCase()] ?? null;
}

function parseStageMessage(state: BattleState, message: ShowdownProtocolMessage, direction: 1 | -1): BattleState {
  const target = message.args[0], statToken = message.args[1], amount = Number(message.args[2] ?? 1);
  if (!target || !statToken) return state;
  const side = sideFromIdent(target), stat = parseStatToken(statToken);
  if (!side || !stat || !Number.isFinite(amount)) return state;
  const pokemon = side === "player" ? state.player : state.opponent;
  const current = pokemon.statStages ?? EMPTY_STAGES;
  const stages = {...current, [stat]: Math.max(-6, Math.min(6, current[stat] + direction * amount))};
  return updateSide(state, side, {statStages: stages});
}

function parseVolatileMessage(state: BattleState, message: ShowdownProtocolMessage, clear: boolean): BattleState {
  const target = message.args[0], condition = message.args[1];
  const side = target ? sideFromIdent(target) : null;
  if (!side || !condition) return state;
  const pokemon = side === "player" ? state.player : state.opponent;
  const current = new Set(pokemon.volatileConditions ?? []);
  if (clear) current.delete(condition); else current.add(condition);
  return updateSide(state, side, {volatileConditions: [...current]});
}

function parseWeatherMessage(state: BattleState, message: ShowdownProtocolMessage, clear: boolean): BattleState {
  const condition = message.args[0]; if (!condition || condition === "none") return clear ? {...state, fieldConditions: []} : state;
  const current = new Set(state.fieldConditions ?? []);
  if (clear) current.delete(condition); else current.add(condition);
  return {...state, fieldConditions: [...current]};
}

function parseFieldMessage(state: BattleState, message: ShowdownProtocolMessage, clear: boolean): BattleState {
  const condition = message.args[0]; if (!condition) return state;
  const current = new Set(state.fieldConditions ?? []);
  if (clear) current.delete(condition); else current.add(condition);
  return {...state, fieldConditions: [...current]};
}

function parseSideConditionMessage(state: BattleState, message: ShowdownProtocolMessage, clear: boolean): BattleState {
  const target = message.args[0], condition = message.args[1];
  const side = target ? sideFromIdent(target) : null;
  if (!side || !condition) return state;
  const key = side === "player" ? "playerSideConditions" : "opponentSideConditions";
  const current = new Set(state[key] ?? []);
  if (clear) current.delete(condition); else current.add(condition);
  return {...state, [key]: [...current]};
}

export function projectShowdownMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  switch (message.type) {
    case "request": return parseRequestMessage(state, message);
    case "-damage":
    case "damage": return parseHpMessage(state, message);
    case "-heal":
    case "-sethp": return parseHpMessage(state, message);
    case "-status":
    case "status": return parseStatusMessage(state, message);
    case "-curestatus": {
      const target = message.args[0]; const side = target ? sideFromIdent(target) : null;
      return side ? updateSide(state, side, {status: null}) : state;
    }
    case "-ability": return parseAbilityMessage(state,message);
    case "-item": return parseItemMessage(state,message,false);
    case "-enditem": return parseItemMessage(state,message,true);
    case "-boost": return parseStageMessage(state,message,1);
    case "-unboost": return parseStageMessage(state,message,-1);
    case "-start": return parseVolatileMessage(state,message,false);
    case "-end": return parseVolatileMessage(state,message,true);
    case "-weather": return parseWeatherMessage(state,message,message.args[0] === "none");
    case "-fieldstart": return parseFieldMessage(state,message,false);
    case "-fieldend": return parseFieldMessage(state,message,true);
    case "-sidestart": return parseSideConditionMessage(state,message,false);
    case "-sideend": return parseSideConditionMessage(state,message,true);
    case "faint": return parseFaintMessage(state, message);
    case "win": return state;
    case "turn": {
      const turn = Number(message.args[0]);
      return Number.isInteger(turn) ? {...state, turn} : state;
    }
    default: return state;
  }
}

export function projectShowdownBlock(state: BattleState, messages: readonly ShowdownProtocolMessage[]): BattleState {
  return messages.reduce(projectShowdownMessage, state);
}
