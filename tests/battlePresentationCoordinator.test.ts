import { describe, expect, it } from "vitest";
import { BattlePresentationCoordinator } from "../src/battle/BattlePresentationCoordinator";
import type { BattleState } from "../src/core/types";

function state(): BattleState {
  const pokemon = {
    id: "p1",
    speciesId: "pikachu",
    formId: "base",
    gender: "male" as const,
    shiny: false,
    level: 50,
    abilityId: "static",
    heldItemId: null,
    hp: 100,
    maxHp: 100,
    status: null,
    moves: [{moveId: "thunderbolt", pp: 15, maxPp: 15}],
  };
  return {
    generation: 9,
    phase: "PLAYER_SELECTING_MOVE",
    turn: 1,
    activeTransactionId: null,
    player: pokemon,
    opponent: {...pokemon, id: "p2", speciesId: "charizard", abilityId: "blaze"},
  };
}

const damage = {
  kind: "damage" as const,
  payload: ["p2a: Charizard", "20/100"],
  source: {type: "-damage", args: ["p2a: Charizard", "20/100"], raw: "|-damage|p2a: Charizard|20/100"},
};

describe("BattlePresentationCoordinator", () => {
  it("requires impact before authoritative damage", () => {
    const coordinator = new BattlePresentationCoordinator(state());
    coordinator.selectMove("thunderbolt");
    coordinator.startMove("tx-1", "thunderbolt");

    expect(() => coordinator.applyAuthoritativeDamage("tx-1", [damage])).toThrow();
    coordinator.markAnimationImpact("tx-1");
    coordinator.applyAuthoritativeDamage("tx-1", [damage]);

    expect(coordinator.state.phase).toBe("DAMAGE_APPLICATION");
  });

  it("accepts a Showdown miss as authoritative resolution", () => {
    const coordinator = new BattlePresentationCoordinator(state());
    coordinator.selectMove("thunderbolt");
    coordinator.startMove("tx-miss", "thunderbolt");
    coordinator.markAnimationImpact("tx-miss");
    coordinator.applyAuthoritativeDamage("tx-miss", [{
      kind: "miss",
      payload: ["p1a: Pikachu", "p2a: Charizard"],
      source: {type: "-miss", args: ["p1a: Pikachu", "p2a: Charizard"], raw: "|-miss|p1a: Pikachu|p2a: Charizard"},
    }]);
    expect(coordinator.state.phase).toBe("DAMAGE_APPLICATION");
  });

  it("returns to move selection when neither side faints", () => {
    const coordinator = new BattlePresentationCoordinator(state());
    coordinator.selectMove("thunderbolt");
    coordinator.startMove("tx-2", "thunderbolt");
    coordinator.markAnimationImpact("tx-2");
    coordinator.applyAuthoritativeDamage("tx-2", [damage]);
    coordinator.resolveSecondaryEffects("tx-2", []);
    coordinator.processStatus("tx-2");
    coordinator.finishTransaction("tx-2", false, false);

    expect(coordinator.state.phase).toBe("PLAYER_SELECTING_MOVE");
  });
});
