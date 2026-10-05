import type { BattlePhase } from "./types";

export type BattleEvent =
  | { readonly type: "INIT_COMPLETE" }
  | { readonly type: "INTRO_COMPLETE" }
  | { readonly type: "PLAYER_MOVE_SELECTED"; readonly moveId: string }
  | { readonly type: "MOVE_VALIDATED" }
  | { readonly type: "MOVE_STARTED"; readonly transactionId: string }
  | { readonly type: "ANIMATION_IMPACT"; readonly transactionId: string }
  | { readonly type: "DAMAGE_RESOLVED"; readonly transactionId: string }
  | { readonly type: "DAMAGE_APPLIED"; readonly transactionId: string }
  | { readonly type: "SECONDARY_EFFECTS_RESOLVED"; readonly transactionId: string }
  | { readonly type: "STATUS_PROCESSED"; readonly transactionId: string }
  | { readonly type: "FAINT_CHECK_COMPLETE"; readonly playerFainted: boolean; readonly opponentFainted: boolean }
  | { readonly type: "BATTLE_ENDED" };

const transitions: Readonly<Partial<Record<BattlePhase, Readonly<Partial<Record<BattleEvent["type"], BattlePhase | undefined>>>>>> = {
  INIT: { INIT_COMPLETE: "INTRO" },
  INTRO: { INTRO_COMPLETE: "PLAYER_SELECTING_MOVE" },
  PLAYER_SELECTING_MOVE: { PLAYER_MOVE_SELECTED: "MOVE_VALIDATING" },
  MOVE_VALIDATING: { MOVE_VALIDATED: "MOVE_START" },
  MOVE_START: { MOVE_STARTED: "MOVE_ANIMATION" },
  MOVE_ANIMATION: { ANIMATION_IMPACT: "MOVE_HIT" },
  MOVE_HIT: { DAMAGE_RESOLVED: "DAMAGE_CALCULATION" },
  DAMAGE_CALCULATION: { DAMAGE_APPLIED: "DAMAGE_APPLICATION" },
  DAMAGE_APPLICATION: { SECONDARY_EFFECTS_RESOLVED: "SECONDARY_EFFECTS" },
  SECONDARY_EFFECTS: { STATUS_PROCESSED: "STATUS_PROCESSING" },
  STATUS_PROCESSING: { FAINT_CHECK_COMPLETE: "FAINT_CHECK" },
  FAINT_CHECK: { FAINT_CHECK_COMPLETE: "VICTORY", BATTLE_ENDED: "BATTLE_END" },
  VICTORY: { BATTLE_ENDED: "BATTLE_END" },
  DEFEAT: { BATTLE_ENDED: "BATTLE_END" },
  BATTLE_END: {}
};

export class InvalidBattleTransitionError extends Error {
  public constructor(phase: BattlePhase, event: BattleEvent["type"]) {
    super(`Invalid battle transition: ${phase} + ${event}`);
    this.name = "InvalidBattleTransitionError";
  }
}

export function transition(phase: BattlePhase, event: BattleEvent): BattlePhase {
  const next = transitions[phase][event.type];
  if (next === undefined) {
    throw new InvalidBattleTransitionError(phase, event.type);
  }

  if (event.type === "FAINT_CHECK_COMPLETE") {
    if (event.playerFainted && !event.opponentFainted) return "DEFEAT";
    if (event.opponentFainted && !event.playerFainted) return "VICTORY";
    if (!event.playerFainted && !event.opponentFainted) return "PLAYER_SELECTING_MOVE";
    throw new InvalidBattleTransitionError(phase, event.type);
  }

  return next;
}
