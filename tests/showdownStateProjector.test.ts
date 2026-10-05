import { describe, expect, it } from "vitest";
import { projectShowdownBlock } from "../src/battle/ShowdownStateProjector";
import type { BattleState } from "../src/core/types";
import { parseShowdownBlock } from "../src/battle/ShowdownProtocol";

function createState(): BattleState {
  const pokemon = {
    id: "pika",
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
    moves: [
      {moveId: "thunderbolt", pp: 15, maxPp: 15},
      {moveId: "quickattack", pp: 30, maxPp: 30},
    ],
  };
  return {
    generation: 9,
    phase: "PLAYER_SELECTING_MOVE",
    turn: 1,
    activeTransactionId: null,
    player: pokemon,
    opponent: {...pokemon, id: "target", speciesId: "charizard", abilityId: "blaze"},
  };
}

describe("ShowdownStateProjector", () => {
  it("projects request HP, status and move PP", () => {
    const block = [
      "|request|{" +
        "\"side\":{\"id\":\"p1\",\"pokemon\":[{\"active\":true,\"condition\":\"73/100\"}]}," +
        "\"active\":[{\"moves\":[{\"id\":\"thunderbolt\",\"pp\":12,\"maxpp\":15}]}]}" +
    ].join("\n");

    const state = projectShowdownBlock(createState(), parseShowdownBlock(block));
    expect(state.player.hp).toBe(73);
    expect(state.player.maxHp).toBe(100);
    expect(state.player.moves[0]?.pp).toBe(12);
  });

  it("does not let raw win events bypass the application state machine", () => {
    const victory = projectShowdownBlock(createState(), parseShowdownBlock("|win|Player"));
    expect(victory.phase).toBe("PLAYER_SELECTING_MOVE");
  });

  it("projects damage, status, faint and turn events", () => {
    const block = [
      "|-damage|p2a: Charizard|40/100",
      "|-status|p2a: Charizard|brn",
      "|turn|3",
      "|faint|p2a: Charizard",
    ].join("\n");

    const state = projectShowdownBlock(createState(), parseShowdownBlock(block));
    expect(state.opponent.hp).toBe(0);
    expect(state.opponent.status).toBe("brn");
    expect(state.turn).toBe(3);
  });
});
