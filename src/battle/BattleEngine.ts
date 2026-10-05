import type { BattleState } from "../core/types";
import type { BattleEvent } from "../core/battleStateMachine";
import { transition } from "../core/battleStateMachine";

export interface BattleEngine {
  readonly state: BattleState;
  dispatch(event: BattleEvent): BattleState;
}

export class BattleStateMachine implements BattleEngine {
  public constructor(public state: BattleState) {}

  public dispatch(event: BattleEvent): BattleState {
    const phase = transition(this.state.phase, event);
    this.state = { ...this.state, phase };
    return this.state;
  }
}
