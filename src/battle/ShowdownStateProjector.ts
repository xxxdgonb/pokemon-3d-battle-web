import type { BattleState, BattleSide, MoveSlot, PokemonBattleState, StatusCondition } from "../core/types";
import type { ShowdownProtocolMessage } from "./ShowdownProtocol";

interface ShowdownRequestPokemon {
  readonly ident?: string;
  readonly condition?: string;
  readonly active?: boolean;
  readonly details?: string;
  readonly moves?: readonly string[];
  readonly baseAbility?: string;
}

interface ShowdownRequestActiveMove {
  readonly move?: string;
  readonly id?: string;
  readonly pp?: number;
  readonly maxpp?: number;
}

interface ShowdownRequest {
  readonly side?: {
    readonly id?: string;
    readonly pokemon?: readonly ShowdownRequestPokemon[];
  };
  readonly active?: readonly [{
    readonly moves?: readonly ShowdownRequestActiveMove[];
  }];
}

function sideFromIdent(ident: string): BattleSide | null {
  if (ident.startsWith("p1")) return "player";
  if (ident.startsWith("p2")) return "opponent";
  return null;
}

function parseCondition(condition: string | undefined): {hp: number; maxHp: number} | null {
  if (!condition) return null;
  const match = condition.match(/^(\d+)(?:\/(\d+))?/);
  if (!match) return null;
  const hp = Number(match[1]);
  const maxHp = match[2] === undefined ? hp : Number(match[2]);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return null;
  return {hp, maxHp};
}

function parseStatus(condition: string | undefined): StatusCondition {
  if (!condition) return null;
  const token = condition.split(" ")[1] ?? "";
  return ["brn", "par", "psn", "tox", "slp", "frz"].includes(token)
    ? token as StatusCondition
    : null;
}

function updatePokemon(
  pokemon: PokemonBattleState,
  patch: Partial<Pick<PokemonBattleState, "hp" | "maxHp" | "status" | "moves" | "abilityId">>,
): PokemonBattleState {
  return {...pokemon, ...patch};
}

function updateSide(state: BattleState, side: BattleSide, patch: Partial<PokemonBattleState>): BattleState {
  const pokemon = side === "player" ? state.player : state.opponent;
  const next = updatePokemon(pokemon, patch);
  return side === "player" ? {...state, player: next} : {...state, opponent: next};
}

function parseRequestMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const raw = message.args[0];
  if (!raw) return state;

  let request: ShowdownRequest;
  try {
    request = JSON.parse(raw) as ShowdownRequest;
  } catch {
    return state;
  }

  const sideId = request.side?.id;
  const side = sideId === "p1" ? "player" : sideId === "p2" ? "opponent" : null;
  if (!side) return state;

  const active = request.side?.pokemon?.find(pokemon => pokemon.active) ?? request.side?.pokemon?.[0];
  const condition = parseCondition(active?.condition);
  const status = parseStatus(active?.condition);

  const moveSource = request.active?.[0]?.moves ?? [];
  const moves: readonly MoveSlot[] = moveSource
    .filter(move => typeof move.id === "string")
    .map(move => ({
      moveId: move.id!,
      pp: Number.isFinite(move.pp) ? move.pp! : 0,
      maxPp: Number.isFinite(move.maxpp) ? move.maxpp! : move.pp ?? 0,
    }));

  const patch: Partial<PokemonBattleState> = {};
  if (condition) {
    patch.hp = condition.hp;
    patch.maxHp = condition.maxHp;
  }
  if (active?.baseAbility) patch.abilityId = active.baseAbility;
  if (moves.length > 0) patch.moves = moves;
  patch.status = status;

  return updateSide(state, side, patch);
}

function parseHpMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0];
  const condition = message.args[1];
  if (!target || !condition) return state;
  const side = sideFromIdent(target);
  if (!side) return state;
  const hp = parseCondition(condition)?.hp;
  if (hp === undefined) return state;
  const pokemon = side === "player" ? state.player : state.opponent;
  return updateSide(state, side, {hp: Math.max(0, Math.min(pokemon.maxHp, hp))});
}

function parseDamageMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0];
  const condition = message.args[1];
  if (!target || !condition) return state;
  const side = sideFromIdent(target);
  if (!side) return state;

  const hp = parseCondition(condition)?.hp;
  if (hp === undefined) return state;
  const pokemon = side === "player" ? state.player : state.opponent;
  return updateSide(state, side, {hp: Math.max(0, Math.min(pokemon.maxHp, hp))});
}

function parseStatusMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0];
  const status = message.args[1];
  const side = target ? sideFromIdent(target) : null;
  if (!side || !status) return state;

  const normalized = ["brn", "par", "psn", "tox", "slp", "frz"].includes(status)
    ? status as StatusCondition
    : null;
  return updateSide(state, side, {status: normalized});
}

function parseFaintMessage(state: BattleState, message: ShowdownProtocolMessage): BattleState {
  const target = message.args[0];
  const side = target ? sideFromIdent(target) : null;
  return side ? updateSide(state, side, {hp: 0}) : state;
}

export function projectShowdownMessage(
  state: BattleState,
  message: ShowdownProtocolMessage,
): BattleState {
  switch (message.type) {
    case "request":
      return parseRequestMessage(state, message);
    case "-damage":
    case "damage":
      return parseDamageMessage(state, message);
    case "-heal":
    case "-sethp":
      return parseHpMessage(state, message);
    case "-status":
    case "status":
      return parseStatusMessage(state, message);
    case "-curestatus": {
      const target = message.args[0];
      const side = target ? sideFromIdent(target) : null;
      return side ? updateSide(state, side, {status: null}) : state;
    }
    case "faint":
      return parseFaintMessage(state, message);
    case "win":
      // Victory/defeat is owned by BattleStateMachine after the faint check.
      // The raw win event is exposed by RemoteShowdownAdapter instead.
      return state;
    case "turn": {
      const turn = Number(message.args[0]);
      return Number.isInteger(turn) ? {...state, turn} : state;
    }
    default:
      return state;
  }
}

export function projectShowdownBlock(
  state: BattleState,
  messages: readonly ShowdownProtocolMessage[],
): BattleState {
  return messages.reduce(projectShowdownMessage, state);
}
