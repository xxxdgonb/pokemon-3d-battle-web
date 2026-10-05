import type { BattleState, BattleSide } from "../core/types";
import type { ShowdownBattleEvent } from "./ShowdownAdapter";
import { BattleTransactionGuard, type BattleTransaction, type MoveResolution } from "./BattleTransaction";
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

  public initializeBattle(): BattleState {
    this.machine.dispatch({type:"INIT_COMPLETE"});
    this.machine.dispatch({type:"INTRO_COMPLETE"});
    return this.machine.state;
  }

  public syncAuthoritativeState(state: BattleState): BattleState {
    return this.machine.syncAuthoritativeFacts(state);
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

  public applyAuthoritativeResolution(transactionId: string, events: readonly ShowdownBattleEvent[]): BattleState {
    const hasAuthoritativeResolution = events.some(event => {
      if (event.kind === "damage") return targetSide(event) === "opponent";
      return event.kind === "miss" || event.kind === "immune" || event.kind === "failed" || event.kind === "move" || event.kind === "heal" || event.kind === "status";
    });
    if (!hasAuthoritativeResolution) {
      throw new Error(`No authoritative opponent move resolution for transaction ${transactionId}.`);
    }

    const resolution = this.resolveOutcome(events);
    this.transactions.markResolved(transactionId, resolution);
    this.machine.dispatch({type: "DAMAGE_RESOLVED", transactionId});
    this.machine.dispatch({type: "DAMAGE_APPLIED", transactionId});
    return this.machine.state;
  }

  public get activeTransaction(): BattleTransaction | null {
    return this.transactions.activeTransaction;
  }

  public resolveSecondaryEffects(transactionId: string, events: readonly ShowdownBattleEvent[]): BattleState {
    void events;
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

  private resolveOutcome(events: readonly ShowdownBattleEvent[]): MoveResolution {
    let critical = false;
    let effectiveness: MoveResolution["effectiveness"] = null;

    for (const event of events) {
      if (event.kind === "crit") critical = true;
      if (event.kind === "effectiveness") {
        const raw = event.source.type;
        effectiveness = raw === "-supereffective" ? "super-effective" : "resisted";
      }
    }

    const damage = events.find(event => event.kind === "damage" && targetSide(event) !== null);
    if (damage) return {kind:"damage", target:targetSide(damage) ?? "opponent", critical, effectiveness};

    const special = events.find(event => event.kind === "miss" || event.kind === "immune" || event.kind === "failed");
    if (special) {
      const kind = special.kind === "miss" || special.kind === "immune" || special.kind === "failed" ? special.kind : "failed";
      return {kind, target:targetSide(special) ?? "opponent", critical, effectiveness};
    }

    const effect = events.find(event => ["heal","status","curestatus","boost","unboost"].includes(event.kind));
    return {kind:"success", target:effect ? (targetSide(effect) ?? "player") : "player", critical, effectiveness};
  }

  public endBattle(): BattleState {
    this.machine.dispatch({type: "BATTLE_ENDED"});
    return this.machine.state;
  }
}
