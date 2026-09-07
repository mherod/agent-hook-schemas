import { expect, test } from "bun:test";
import { checkCoverage } from "./scripts/check-coverage.ts";

const sources = new Map([["example.ts", "export const answer = 42;\n"]]);
const complete = "SF:example.ts\nFNF:0\nFNH:0\nDA:1,1\nend_of_record\n";

test("coverage gate accepts fully covered library modules", () => {
  expect(checkCoverage(complete, sources)).toEqual([]);
});

test("coverage gate rejects missing modules and an empty report", () => {
  expect(checkCoverage("", sources)).toEqual(["Missing coverage source: example.ts"]);
  expect(checkCoverage(complete, new Map([...sources, ["new.ts", "export function newFeature() {}"]]))).toEqual(["Missing coverage source: new.ts"]);
});

test("coverage gate rejects any uncovered line or function", () => {
  expect(checkCoverage(complete.replace("DA:1,1", "DA:1,0"), sources)).toEqual(["example.ts:1: uncovered line"]);
  expect(checkCoverage(complete.replace("FNF:0", "FNF:1"), sources)).toEqual(["example.ts: function coverage must be 100%"]);
});

test("coverage gate rejects incomplete, duplicate and unexpected module records", () => {
  expect(checkCoverage(complete.replace("FNH:0\n", ""), sources)).toEqual(["example.ts: function coverage must be 100%"]);
  expect(checkCoverage(complete.replace("DA:1,1\n", ""), sources)).toEqual(["example.ts: missing line coverage"]);
  expect(checkCoverage(complete + complete, sources)).toEqual(["Duplicate coverage source: example.ts"]);
  expect(checkCoverage(complete.replace("example.ts", "generated.ts"), sources)).toEqual([
    "Unexpected coverage source: generated.ts", "Missing coverage source: example.ts",
  ]);
});

test("the sole exception covers only the exact common.ts exhaustiveness guard", () => {
  const source = "switch (hookEventName) {\n    default: {\n      const _x: never = hookEventName;\n      return _x;\n    }\n}";
  const report = "SF:common.ts\nFNF:1\nFNH:1\nDA:1,1\nDA:2,0\nDA:3,0\nDA:4,0\nend_of_record\n";
  expect(checkCoverage(report, new Map([["common.ts", source]]))).toEqual([]);
  expect(checkCoverage(report.replace("DA:1,1", "DA:1,0"), new Map([["common.ts", source]]))).toEqual(["common.ts:1: uncovered line"]);
  expect(checkCoverage(report, new Map([["common.ts", source.replace("return _x", "return undefined")]]))).toHaveLength(3);
  expect(checkCoverage(report.replace("common.ts", "other.ts"), new Map([["other.ts", source]]))).toHaveLength(3);
});
