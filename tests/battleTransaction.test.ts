import { describe, expect, it } from "vitest";
import { BattleTransactionGuard } from "../src/battle/BattleTransaction";

describe("battle transaction guard", () => {
  it("prevents a second active move transaction", () => {
    const guard = new BattleTransactionGuard();
    guard.begin({ id: "tx-1", actor: "player", target: "opponent", moveId: "tackle", startedAt: 1 });
    expect(() => guard.begin({ id: "tx-2", actor: "player", target: "opponent", moveId: "ember", startedAt: 2 })).toThrow();
  });

  it("requires impact before damage and prevents duplicate damage", () => {
    const guard = new BattleTransactionGuard();
    guard.begin({ id: "tx-1", actor: "player", target: "opponent", moveId: "tackle", startedAt: 1 });

    expect(() => guard.markDamageApplied("tx-1")).toThrow();
    guard.markImpact("tx-1");
    guard.markDamageApplied("tx-1");
    expect(() => guard.markDamageApplied("tx-1")).toThrow();
  });

  it("requires damage before completion", () => {
    const guard = new BattleTransactionGuard();
    guard.begin({ id: "tx-1", actor: "player", target: "opponent", moveId: "tackle", startedAt: 1 });
    guard.markImpact("tx-1");
    expect(() => guard.complete("tx-1")).toThrow();
    guard.markDamageApplied("tx-1");
    expect(guard.complete("tx-1").completed).toBe(true);
    expect(guard.activeTransaction).toBeNull();
  });
});
