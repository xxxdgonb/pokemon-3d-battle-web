import type { BattleState, Generation, MoveSlot, PokemonBattleState } from "../core/types";
import type { ShowdownProtocolMessage } from "./ShowdownProtocol";

export interface ShowdownBattleConfig {
  readonly generation: Generation;
  readonly player: PokemonBattleState;
  readonly opponent: PokemonBattleState;
}

export interface ShowdownBattleEvent {
  readonly kind: "log" | "request" | "move" | "damage" | "status" | "faint" | "miss" | "immune" | "failed" | "crit" | "effectiveness" | "battle-end" | "turn-end";
  readonly payload: unknown;
  readonly source: ShowdownProtocolMessage;
}

/**
 * Browser-side transport boundary.
 *
 * The actual Pokémon Showdown simulator remains in a Node.js runtime.
 * A concrete implementation may use WebSocket or another authenticated
 * request/stream transport; the browser must not import the simulator package.
 */
export interface ShowdownTransport {
  connect(config: ShowdownBattleConfig): Promise<void>;
  send(command: string): Promise<void>;
  close(): Promise<void>;
  waitForBlock(): Promise<string>;
  onMessage(listener: (block: string) => void): () => void;
}

export interface ShowdownAdapter {
  readonly runtime: "remote";
  createBattle(config: ShowdownBattleConfig): Promise<void>;
  submitPlayerMove(move: MoveSlot["moveId"]): Promise<readonly ShowdownBattleEvent[]>;
  getState(): Promise<BattleState>;
  dispose(): Promise<void>;
}

export type ShowdownAdapterFactory = (
  transport: ShowdownTransport,
  config: ShowdownBattleConfig
) => ShowdownAdapter;
