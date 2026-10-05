import type { BattleState, BattleSide } from "../core/types";
import type { ShowdownBattleEvent } from "./ShowdownAdapter";
import { BattleTransactionGuard, type BattleTransaction } from "./BattleTransaction";
import { BattleStateMachine } from "./BattleEngine";

function targetSide(event: ShowdownBattleEvent): BattleSide | null {
  const raw = event.payload;
  if (!Array.isArray(raw) || typeof raw[0] !== "string") return null;
  if (raw[0].startsWith("p1")) return "player";
  if (raw[0].startsWith("p2")) return "opponent";
  return null;
}

export class BattlePresentationCoordinator {
  private readonly machine: BattleStateMachine;
  private readonly transactions = new BattleTransactionGuard();

  public constructor(initialState: BattleState) {
    this.machine = new BattleStateMachine(initialState);
  }

  public get state(): BattleState {
    return this.machine.state;
  }

  public selectMove(moveId: string): BattleState {
    this.machine.dispatch({type: "PLAYER_MOVE_SELECTED", moveId});
    this.machine.dispatch({type: "MOVE_VALIDATED"});
    return this.machine.state;
  }

  public startMove(transactionId: string, moveId: string): BattleTransaction {
    const tx = this.transactions.begin({
      id: transactionId,
      actor: "player",
      target: "opponent",
      moveId,
      startedAt: Date.now(),
    });
    this.machine.dispatch({type: "MOVE_STARTED", transactionId});
    return tx;
  }

  public markAnimationImpact(transactionId: string): BattleState {
    this.transactions.markImpact(transactionId);
    this.machine.dispatch({type: "ANIMATION_IMPACT", transactionId});
    return this.machine.state;
  }

  public applyAuthoritativeDamage(transactionId: string, events: readonly ShowdownBattleEvent[]): BattleState {
    const hasAuthoritativeResolution = events.some(event => {
      if (event.kind === "damage") return targetSide(event) === "opponent";
      return event.kind === "miss" || event.kind === "immune" || event.kind === "failed";
    });
    if (!hasAuthoritativeResolution) {
      throw new Error(`No authoritative opponent move resolution for transaction ${transactionId}.`);
    }

    this.transactions.markDamageApplied(transactionId);
    this.machine.dispatch({type: "DAMAGE_RESOLVED", transactionId});
    this.machine.dispatch({type: "DAMAGE_APPLIED", transactionId});
    return this.machine.state;
  }

  public resolveSecondaryEffects(transactionId: string, _events: readonly ShowdownBattleEvent[]): BattleState {
    this.machine.dispatch({type: "SECONDARY_EFFECTS_RESOLVED", transactionId});
    return this.machine.state;
  }

  public processStatus(transactionId: string): BattleState {
    this.machine.dispatch({type: "STATUS_PROCESSED", transactionId});
    return this.machine.state;
  }

  public finishTransaction(
    transactionId: string,
    playerFainted: boolean,
    opponentFainted: boolean,
  ): BattleState {
    this.machine.dispatch({
      type: "FAINT_CHECK_COMPLETE",
      playerFainted,
      opponentFainted,
    });
    this.transactions.complete(transactionId);
    return this.machine.state;
  }

  public endBattle(): BattleState {
    this.machine.dispatch({type: "BATTLE_ENDED"});
    return this.machine.state;
  }
}
