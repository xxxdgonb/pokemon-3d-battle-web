import type { BattleState, Generation, MoveSlot, PokemonBattleState } from "../core/types";

export interface ShowdownBattleConfig {
  readonly generation: Generation;
  readonly player: PokemonBattleState;
  readonly opponent: PokemonBattleState;
}

export interface ShowdownBattleEvent {
  readonly kind: "log" | "request" | "damage" | "status" | "faint" | "turn-end";
  readonly payload: unknown;
}

export interface ShowdownAdapter {
  readonly runtime: "server" | "worker" | "browser";
  createBattle(config: ShowdownBattleConfig): Promise<void>;
  submitPlayerMove(move: MoveSlot["moveId"]): Promise<readonly ShowdownBattleEvent[]>;
  getState(): Promise<BattleState>;
}

export type ShowdownAdapterFactory = (config: ShowdownBattleConfig) => ShowdownAdapter;
