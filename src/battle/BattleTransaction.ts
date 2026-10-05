import type { MoveSlot } from "../core/types";

export interface BattleTransaction {
  readonly id: string;
  readonly actor: "player" | "opponent";
  readonly target: "player" | "opponent";
  readonly moveId: MoveSlot["moveId"];
  readonly startedAt: number;
  readonly impactReached: boolean;
  readonly damageApplied: boolean;
  readonly completed: boolean;
}

export class BattleTransactionGuard {
  private active: BattleTransaction | null = null;

  public begin(input: Omit<BattleTransaction, "impactReached" | "damageApplied" | "completed">): BattleTransaction {
    if (this.active !== null) {
      throw new Error("A battle transaction is already active.");
    }

    this.active = {
      ...input,
      impactReached: false,
      damageApplied: false,
      completed: false
    };

    return this.active;
  }

  public markImpact(id: string): BattleTransaction {
    const tx = this.require(id);
    if (tx.impactReached) throw new Error(`Transaction ${id} impact was already emitted.`);
    this.active = { ...tx, impactReached: true };
    return this.active;
  }

  public markDamageApplied(id: string): BattleTransaction {
    const tx = this.require(id);
    if (!tx.impactReached) throw new Error(`Transaction ${id} cannot apply damage before impact.`);
    if (tx.damageApplied) throw new Error(`Transaction ${id} resolution was already applied.`);
    this.active = { ...tx, damageApplied: true };
    return this.active;
  }

  public complete(id: string): BattleTransaction {
    const tx = this.require(id);
    if (!tx.damageApplied) throw new Error(`Transaction ${id} cannot complete before damage application.`);
    this.active = { ...tx, completed: true };
    const completed = this.active;
    this.active = null;
    return completed;
  }

  public get activeTransaction(): BattleTransaction | null {
    return this.active;
  }

  private require(id: string): BattleTransaction {
    if (this.active === null || this.active.id !== id) {
      throw new Error(`Unknown or inactive battle transaction: ${id}`);
    }
    return this.active;
  }
}
