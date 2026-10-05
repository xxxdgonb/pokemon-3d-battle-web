import { describe, expect, it } from "vitest";
import { encodeChoice, parseShowdownBlock, parseShowdownLine } from "../src/battle/ShowdownProtocol";

describe("Showdown protocol boundary", () => {
  it("parses pipe-delimited messages", () => {
    expect(parseShowdownLine("|turn|3")).toEqual({
      type: "turn",
      args: ["3"],
      raw: "|turn|3"
    });
  });

  it("parses protocol blocks", () => {
    expect(parseShowdownBlock("|start\n|request|{\"rqid\":1}")).toHaveLength(2);
  });

  it("validates move identifiers before encoding choices", () => {
    expect(encodeChoice("flamethrower")).toBe("move flamethrower");
    expect(() => encodeChoice("move\n1")).toThrow();
  });
});
