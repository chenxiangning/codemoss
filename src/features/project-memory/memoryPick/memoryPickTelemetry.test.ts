import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitMemoryPickTelemetry,
  hashQueryForTelemetry,
  sanitizeMemoryPickTelemetryProps,
  setMemoryPickTelemetrySink,
} from "./memoryPickTelemetry";

afterEach(() => {
  setMemoryPickTelemetrySink(null);
});

describe("sanitizeMemoryPickTelemetryProps", () => {
  it("keeps whitelist keys only", () => {
    const safe = sanitizeMemoryPickTelemetryProps({
      mode: "always",
      candidateCount: 3,
      emptyReason: "no_match",
      retrievalMode: "lexical",
      ms: 12,
      query: "用户完整提问不得出现",
      queryText: "secret",
      detail: "记忆正文",
      title: "标题",
      unknownKey: "drop-me",
    });
    expect(safe).toEqual({
      mode: "always",
      candidateCount: 3,
      emptyReason: "no_match",
      retrievalMode: "lexical",
      ms: 12,
    });
    expect(safe).not.toHaveProperty("query");
    expect(safe).not.toHaveProperty("detail");
  });

  it("drops overly long strings", () => {
    const safe = sanitizeMemoryPickTelemetryProps({
      fallbackReason: "x".repeat(200),
      mode: "pick",
    });
    expect(safe).toEqual({ mode: "pick" });
  });
});

describe("emitMemoryPickTelemetry", () => {
  it("routes to injected sink with sanitized props", () => {
    const sink = vi.fn();
    setMemoryPickTelemetrySink(sink);
    emitMemoryPickTelemetry("memory_pick_retrieve", {
      emptyReason: "timeout",
      ms: 40,
      query: "全文不该进 sink",
      candidateCount: 0,
    });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("memory_pick_retrieve", {
      emptyReason: "timeout",
      ms: 40,
      candidateCount: 0,
    });
  });

  it("does not throw when sink throws", () => {
    setMemoryPickTelemetrySink(() => {
      throw new Error("sink down");
    });
    expect(() =>
      emitMemoryPickTelemetry("memory_pick_skip", { mode: "pick" }),
    ).not.toThrow();
  });
});

describe("hashQueryForTelemetry", () => {
  it("is stable for same input", () => {
    expect(hashQueryForTelemetry("数据库超时")).toBe(
      hashQueryForTelemetry("数据库超时"),
    );
    expect(hashQueryForTelemetry("a")).not.toBe(hashQueryForTelemetry("b"));
  });
});
