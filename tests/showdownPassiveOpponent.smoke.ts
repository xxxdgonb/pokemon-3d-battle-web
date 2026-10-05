import { createRequire } from "node:module";
import type { BattleStream as BattleStreamType } from "pokemon-showdown";
const require = createRequire(import.meta.url);
const {BattleStream} = require("pokemon-showdown") as {BattleStream: typeof BattleStreamType};

const battle = new BattleStream({noCatch: false});
const outputs: string[] = [];

const reader = (async () => {
  for await (const output of battle) outputs.push(output);
})();

const pokemon = (name: string, species: string) => ({
  name,
  species,
  item: "",
  ability: species === "pikachu" ? "static" : "blaze",
  moves: ["tackle"],
  nature: "Serious",
  teraType: "",
  gender: "",
  evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
  ivs: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31},
  level: 50,
  shiny: false,
});

await battle.write(`>start {"formatid":"gen9customgame"}`);
await battle.write(`>player p1 ${JSON.stringify({name: "Player", team: [pokemon("Pikachu", "Pikachu")]})}`);
await battle.write(`>player p2 ${JSON.stringify({name: "Opponent", team: [pokemon("Charizard", "Charizard")]})}`);
await battle.write(">p1 team 1");
await battle.write(">p2 team 1");
await battle.write(">p1 move tackle");

const sim = battle.battle;
if (!sim) throw new Error("Showdown did not initialize a Battle instance.");
const passive = sim.sides[1];
if (!passive || passive.requestState !== "move" || passive.isChoiceDone()) {
  throw new Error("Passive opponent did not reach a move request after player move.");
}

if (!passive.choose("pass")) throw new Error("Showdown rejected the passive pass choice.");

const moveMarker = "|move|p1a: Pikachu|Tackle|";
const deadline = Date.now() + 2000;
while (!outputs.join("").includes(moveMarker) && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 10));
}
const output = outputs.join("");
console.log("SHOWDOWN_SMOKE_OUTPUT", JSON.stringify(output));
console.log("SHOWDOWN_TURN", sim.turn, "P1_CHOICE_DONE", sim.sides[0]?.isChoiceDone(), "P2_CHOICE_DONE", sim.sides[1]?.isChoiceDone());
if (!output.includes("|move|p1a: Pikachu|Tackle|")) {
  throw new Error("Showdown did not execute the player's move.");
}
const moveMatches = output.match(/\|move\|p1a: Pikachu\|Tackle\|/g) ?? [];
if (moveMatches.length !== 1) {
  throw new Error(`Expected exactly one player move execution, got ${moveMatches.length}.`);
}
const damageMatches = output.match(/\|-damage\|p2a: Charizard\|/g) ?? [];
if (damageMatches.length !== 1) {
  throw new Error(`Expected exactly one authoritative damage event, got ${damageMatches.length}.`);
}
if (!output.includes("|-damage|p2a: Charizard|")) {
  throw new Error("Showdown did not emit authoritative damage for the passive-opponent smoke battle.");
}

battle.writeEnd();
await reader;
console.log("Showdown passive-opponent smoke test passed.");
