import type { BattleState } from "../core/types";
import type { BattleEvent } from "../core/battleStateMachine";
import { transition } from "../core/battleStateMachine";

export interface BattleEngine {
  readonly state: BattleState;
  dispatch(event: BattleEvent): BattleState;
}

export class BattleStateMachine implements BattleEngine {
  public constructor(public state: BattleState) {}

  public syncAuthoritativeFacts(authoritative: BattleState): BattleState {
    this.state = {
      ...this.state,
      generation: authoritative.generation,
      turn: authoritative.turn,
      player: authoritative.player,
      opponent: authoritative.opponent,
    };
    return this.state;
  }

  public dispatch(event: BattleEvent): BattleState {
    const phase = transition(this.state.phase, event);
    let nextState: BattleState = {...this.state, phase};

    if (event.type === "MOVE_STARTED") {
      nextState = {...nextState, activeTransactionId: event.transactionId};
    } else if (event.type === "FAINT_CHECK_COMPLETE") {
      nextState = {...nextState, activeTransactionId: null};
    }

    this.state = nextState;
    return this.state;
  }
}
