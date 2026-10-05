import type { MoveSlot } from "../core/types";

export type MoveResolutionKind = "damage" | "miss" | "immune" | "failed";

export interface MoveResolution {
  readonly kind: MoveResolutionKind;
  readonly target: "player" | "opponent";
  readonly critical: boolean;
  readonly effectiveness: "super-effective" | "resisted" | "neutral" | null;
}

export interface BattleTransaction {
  readonly id: string;
  readonly actor: "player" | "opponent";
  readonly target: "player" | "opponent";
  readonly moveId: MoveSlot["moveId"];
  readonly startedAt: number;
  readonly impactReached: boolean;
  readonly damageApplied: boolean;
  readonly resolution: MoveResolution | null;
  readonly completed: boolean;
}

export class BattleTransactionGuard {
  private active: BattleTransaction | null = null;

  public begin(input: Omit<BattleTransaction, "impactReached" | "damageApplied" | "resolution" | "completed">): BattleTransaction {
    if (this.active !== null) {
      throw new Error("A battle transaction is already active.");
    }

    this.active = {
      ...input,
      impactReached: false,
      damageApplied: false,
      resolution: null,
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

  public markResolved(id: string, resolution: MoveResolution): BattleTransaction {
    const tx = this.require(id);
    if (!tx.impactReached) throw new Error(`Transaction ${id} cannot resolve before impact.`);
    if (tx.damageApplied) throw new Error(`Transaction ${id} resolution was already applied.`);
    this.active = { ...tx, damageApplied: true, resolution };
    return this.active;
  }

  public markDamageApplied(id: string): BattleTransaction {
    const tx = this.require(id);
    if (!tx.impactReached) throw new Error(`Transaction ${id} cannot apply damage before impact.`);
    if (tx.damageApplied) throw new Error(`Transaction ${id} resolution was already applied.`);
    this.active = { ...tx, damageApplied: true, resolution: tx.resolution };
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
