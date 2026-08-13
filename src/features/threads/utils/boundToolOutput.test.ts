// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  boundToolOutput,
  COMMAND_EXECUTION_OUTPUT_BUDGET,
  COMMAND_EXECUTION_OUTPUT_HEAD,
  FILE_CHANGE_OUTPUT_BUDGET,
} from "./boundToolOutput";
import {
  __resetRealtimePerfFlagCacheForTests,
  resetRealtimePerfFlags,
} from "./realtimePerfFlags";

describe("boundToolOutput", () => {
  beforeEach(() => {
    resetRealtimePerfFlags();
  });

  afterEach(() => {
    resetRealtimePerfFlags();
    __resetRealtimePerfFlagCacheForTests();
  });

  it("keeps commandExecution text under the budget", () => {
    const text = "H".repeat(COMMAND_EXECUTION_OUTPUT_HEAD) + "M".repeat(8 * 1024 * 1024) + "T".repeat(80_000);
    const bounded = boundToolOutput(text, "commandExecution");
    expect(bounded.length).toBeLessThanOrEqual(COMMAND_EXECUTION_OUTPUT_BUDGET);
    expect(bounded.startsWith("H".repeat(COMMAND_EXECUTION_OUTPUT_HEAD))).toBe(true);
    expect(bounded.endsWith("T".repeat(1000))).toBe(true);
    expect(bounded).toMatch(/omitted \d+ chars/);
    const omitted = Number(bounded.match(/omitted (\d+) chars/)?.[1]);
    expect(omitted).toBeGreaterThan(7 * 1024 * 1024);
  });

  it("accumulates omitted count when appending to an already bounded item", () => {
    const first = boundToolOutput(
      `${"A".repeat(COMMAND_EXECUTION_OUTPUT_HEAD)}${"B".repeat(400_000)}`,
      "commandExecution",
    );
    const firstOmitted = Number(first.match(/omitted (\d+) chars/)?.[1] ?? 0);
    expect(firstOmitted).toBeGreaterThan(0);
    const next = boundToolOutput(`${first}${"C".repeat(80_000)}`, "commandExecution");
    const nextOmitted = Number(next.match(/omitted (\d+) chars/)?.[1] ?? 0);
    expect(next.length).toBeLessThanOrEqual(COMMAND_EXECUTION_OUTPUT_BUDGET);
    expect(nextOmitted).toBeGreaterThan(firstOmitted);
    expect(next.endsWith("C".repeat(1000))).toBe(true);
    expect(next.startsWith("A".repeat(COMMAND_EXECUTION_OUTPUT_HEAD))).toBe(true);
  });

  it("preserves small fileChange diffs", () => {
    const diff = "patch\n".repeat(1000);
    expect(boundToolOutput(diff, "fileChange")).toBe(diff);
  });

  it("bounds huge fileChange output", () => {
    const diff = "x".repeat(FILE_CHANGE_OUTPUT_BUDGET + 50_000);
    const bounded = boundToolOutput(diff, "fileChange");
    expect(bounded.length).toBeLessThanOrEqual(FILE_CHANGE_OUTPUT_BUDGET);
    expect(bounded).toMatch(/omitted \d+ chars/);
  });

  it("leaves unknown tool kinds untouched", () => {
    const text = "y".repeat(300_000);
    expect(boundToolOutput(text, "webSearch")).toBe(text);
  });

  it("returns input unchanged when the budget flag is off", () => {
    window.localStorage.setItem("ccgui.perf.toolOutputBudget", "off");
    const text = "z".repeat(COMMAND_EXECUTION_OUTPUT_BUDGET + 10_000);
    expect(boundToolOutput(text, "commandExecution")).toBe(text);
  });
});
