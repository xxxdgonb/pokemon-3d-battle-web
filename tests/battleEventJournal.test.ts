import { describe, expect, it } from "vitest";
import { summarizeBattleEvents } from "../src/battle/BattleEventJournal";
import type { ShowdownBattleEvent } from "../src/battle/ShowdownAdapter";

function event(kind: ShowdownBattleEvent["kind"], args: unknown[], type = kind): ShowdownBattleEvent {
  return {kind, payload: args, source: {type, args: args.map(String)} as never};
}

describe("battle event journal", () => {
  it("preserves multi-hit damage and healing as separate authoritative events", () => {
    const summary = summarizeBattleEvents([
      event("move", ["p1a:Bulbasaur", "Petal Dance"], "move"),
      event("damage", ["p2a:Charizard", "90/120"], "-damage"),
      event("damage", ["p2a:Charizard", "45/120"], "-damage"),
      event("heal", ["p1a:Bulbasaur", "80/100"], "-heal"),
    ]);

    expect(summary.moveId).toBe("petaldance");
    expect(summary.target).toBe("opponent");
    expect(summary.damage).toHaveLength(2);
    expect(summary.healing).toHaveLength(1);
  });

  it("records status, stat, ability/item and faint events", () => {
    const summary = summarizeBattleEvents([
      event("status", ["p2a:Charizard", "brn"], "-status"),
      event("boost", ["p1a:Bulbasaur", "atk", "2"], "-boost"),
      event("ability", ["p1a:Bulbasaur", "Overgrow"], "-ability"),
      event("enditem", ["p2a:Charizard", "Leftovers"], "-enditem"),
      event("faint", ["p2a:Charizard"], "faint"),
      event("crit", ["p2a:Charizard"], "-crit"),
      event("effectiveness", ["p2a:Charizard"], "-supereffective"),
    ]);

    expect(summary.statuses).toHaveLength(1);
    expect(summary.statChanges).toHaveLength(1);
    expect(summary.abilityItemEvents).toHaveLength(2);
    expect(summary.fainted).toEqual(["opponent"]);
    expect(summary.critical).toBe(true);
    expect(summary.effectiveness).toBe("super-effective");
  });
});
