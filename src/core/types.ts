export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BattleSide = "player" | "opponent";

export type Gender = "male" | "female" | "genderless";

export type StatusCondition =
  | "brn"
  | "par"
  | "psn"
  | "tox"
  | "slp"
  | "frz"
  | null;

export type BattlePhase =
  | "INIT"
  | "INTRO"
  | "PLAYER_SELECTING_MOVE"
  | "MOVE_VALIDATING"
  | "MOVE_START"
  | "MOVE_ANIMATION"
  | "MOVE_HIT"
  | "DAMAGE_CALCULATION"
  | "DAMAGE_APPLICATION"
  | "SECONDARY_EFFECTS"
  | "STATUS_PROCESSING"
  | "FAINT_CHECK"
  | "VICTORY"
  | "DEFEAT"
  | "BATTLE_END";

export interface MoveSlot {
  readonly moveId: string;
  readonly pp: number;
  readonly maxPp: number;
}

export interface PokemonBattleState {
  readonly id: string;
  readonly speciesId: string;
  readonly formId: string;
  readonly gender: Gender;
  readonly shiny: boolean;
  readonly level: number;
  readonly abilityId: string;
  readonly heldItemId: string | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly status: StatusCondition;
  readonly moves: readonly MoveSlot[];
}

export interface BattleState {
  readonly generation: Generation;
  readonly phase: BattlePhase;
  readonly turn: number;
  readonly activeTransactionId: string | null;
  readonly player: PokemonBattleState;
  readonly opponent: PokemonBattleState;
}
