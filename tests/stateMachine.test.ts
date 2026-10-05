import { describe, expect, it } from "vitest";
import { InvalidBattleTransitionError, transition } from "../src/core/battleStateMachine";

describe("battle state machine", () => {
  it("follows the authoritative move pipeline", () => {
    expect(transition("PLAYER_SELECTING_MOVE", { type: "PLAYER_MOVE_SELECTED", moveId: "tackle" })).toBe("MOVE_VALIDATING");
    expect(transition("MOVE_VALIDATING", { type: "MOVE_VALIDATED" })).toBe("MOVE_START");
    expect(transition("MOVE_START", { type: "MOVE_STARTED", transactionId: "tx-1" })).toBe("MOVE_ANIMATION");
    expect(transition("MOVE_ANIMATION", { type: "ANIMATION_IMPACT", transactionId: "tx-1" })).toBe("MOVE_HIT");
    expect(transition("MOVE_HIT", { type: "DAMAGE_RESOLVED", transactionId: "tx-1" })).toBe("DAMAGE_CALCULATION");
    expect(transition("DAMAGE_CALCULATION", { type: "DAMAGE_APPLIED", transactionId: "tx-1" })).toBe("DAMAGE_APPLICATION");
    expect(transition("DAMAGE_APPLICATION", { type: "SECONDARY_EFFECTS_RESOLVED", transactionId: "tx-1" })).toBe("SECONDARY_EFFECTS");
    expect(transition("SECONDARY_EFFECTS", { type: "STATUS_PROCESSED", transactionId: "tx-1" })).toBe("STATUS_PROCESSING");
    expect(transition("STATUS_PROCESSING", { type: "FAINT_CHECK_COMPLETE", playerFainted: false, opponentFainted: true })).toBe("VICTORY");
  });

  it("returns to move selection when neither side has fainted", () => {
    expect(transition("STATUS_PROCESSING", { type: "FAINT_CHECK_COMPLETE", playerFainted: false, opponentFainted: false })).toBe("PLAYER_SELECTING_MOVE");
  });

  it("rejects illegal transitions", () => {
    expect(() => transition("PLAYER_SELECTING_MOVE", { type: "DAMAGE_APPLIED", transactionId: "tx-1" })).toThrow(InvalidBattleTransitionError);
  });
});
