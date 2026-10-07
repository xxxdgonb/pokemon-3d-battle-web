import type { ShowdownBattleEvent } from "./ShowdownAdapter";
import type { BattleSide } from "../core/types";

export interface BattleDamageEvent {
  readonly target: BattleSide;
  readonly amount: number;
  readonly raw: readonly unknown[];
}

export interface BattleHealEvent {
  readonly target: BattleSide;
  readonly amount: number;
  readonly raw: readonly unknown[];
}

export interface BattleResolutionSummary {
  readonly moveId: string | null;
  readonly target: BattleSide | null;
  readonly damage: readonly BattleDamageEvent[];
  readonly healing: readonly BattleHealEvent[];
  readonly statuses: readonly ShowdownBattleEvent[];
  readonly statChanges: readonly ShowdownBattleEvent[];
  readonly abilityItemEvents: readonly ShowdownBattleEvent[];
  readonly fainted: readonly BattleSide[];
  readonly miss: boolean;
  readonly immune: boolean;
  readonly failed: boolean;
  readonly critical: boolean;
  readonly effectiveness: "super-effective" | "resisted" | "neutral" | null;
}

function sideFromTarget(value: unknown): BattleSide | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("p1")) return "player";
  if (value.startsWith("p2")) return "opponent";
  return null;
}

function numericAmount(args: readonly unknown[]): number {
  const candidates = args.filter(value => typeof value === "string" || typeof value === "number");
  for (const value of candidates.slice(1).reverse()) {
    const n = typeof value === "number" ? value : Number(String(value).split("/")[0]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export function summarizeBattleEvents(events: readonly ShowdownBattleEvent[]): BattleResolutionSummary {
  const damage: BattleDamageEvent[] = [];
  const healing: BattleHealEvent[] = [];
  const statuses: ShowdownBattleEvent[] = [];
  const statChanges: ShowdownBattleEvent[] = [];
  const abilityItemEvents: ShowdownBattleEvent[] = [];
  const fainted = new Set<BattleSide>();

  let moveId: string | null = null;
  let target: BattleSide | null = null;
  let miss = false;
  let immune = false;
  let failed = false;
  let critical = false;
  let effectiveness: BattleResolutionSummary["effectiveness"] = null;

  for (const event of events) {
    const args = Array.isArray(event.payload) ? event.payload : [];
    const eventTarget = sideFromTarget(args[0]);
    if (eventTarget && event.kind !== "move") target ??= eventTarget;

    if (event.kind === "move" && typeof args[1] === "string") {
      moveId = String(args[1]).toLowerCase().replace(/[^a-z0-9]+/g, "");
      const moveTarget = sideFromTarget(args[0]);
      if (moveTarget && event.kind !== "move") target = moveTarget;
    }
    if (event.kind === "damage" && eventTarget) {
      damage.push({target: eventTarget, amount: numericAmount(args), raw: args});
    }
    if (event.kind === "heal" && eventTarget) {
      healing.push({target: eventTarget, amount: numericAmount(args), raw: args});
    }
    if (event.kind === "status" || event.kind === "curestatus") statuses.push(event);
    if (event.kind === "boost" || event.kind === "unboost") statChanges.push(event);
    if (event.kind === "ability" || event.kind === "item" || event.kind === "enditem") abilityItemEvents.push(event);
    if (event.kind === "faint" && eventTarget) fainted.add(eventTarget);
    if (event.kind === "miss") miss = true;
    if (event.kind === "immune") immune = true;
    if (event.kind === "failed") failed = true;
    if (event.kind === "crit") critical = true;
    if (event.kind === "effectiveness") {
      const marker = event.source.type;
      if (marker === "-supereffective") effectiveness = "super-effective";
      else if (marker === "-resisted") effectiveness = "resisted";
    }
  }

  if (effectiveness === null && damage.length > 0 && !miss && !immune && !failed) effectiveness = "neutral";

  return {
    moveId,
    target,
    damage,
    healing,
    statuses,
    statChanges,
    abilityItemEvents,
    fainted: [...fainted],
    miss,
    immune,
    failed,
    critical,
    effectiveness,
  };
}
