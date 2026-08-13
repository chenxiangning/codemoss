import { describe, expect, it } from "vitest";
import {
  buildMemoryPickEmptyTimelinePreview,
  resolveMemoryPickEmptyNoticeMessage,
  toastMemoryPickEmptyReason,
} from "./memoryEmptyReasonToast";

describe("resolveMemoryPickEmptyNoticeMessage", () => {
  it("returns null for ok", () => {
    expect(resolveMemoryPickEmptyNoticeMessage("ok")).toBeNull();
  });

  it("resolves timeout / no_match / error copy", () => {
    expect(resolveMemoryPickEmptyNoticeMessage("timeout")).toContain("超时");
    expect(resolveMemoryPickEmptyNoticeMessage("no_match")).toContain("未找到");
    expect(resolveMemoryPickEmptyNoticeMessage("error")).toContain("失败");
  });

  it("includes no_query_terms by default and can skip", () => {
    expect(resolveMemoryPickEmptyNoticeMessage("no_query_terms")).toContain(
      "关键词",
    );
    expect(
      resolveMemoryPickEmptyNoticeMessage("no_query_terms", {
        includeNoQueryTerms: false,
      }),
    ).toBeNull();
  });

  it("accepts copy overrides", () => {
    expect(
      resolveMemoryPickEmptyNoticeMessage("no_match", {
        copy: { no_match: "自定义空结果" },
      }),
    ).toBe("自定义空结果");
  });
});

describe("buildMemoryPickEmptyTimelinePreview", () => {
  it("builds reason + title + message for timeline", () => {
    const preview = buildMemoryPickEmptyTimelinePreview("no_match", {
      copy: { title: "记忆参考", no_match: "未找到相关记忆，已按原文发送" },
    });
    expect(preview).toEqual({
      reason: "no_match",
      title: "记忆参考",
      message: "未找到相关记忆，已按原文发送",
    });
  });
});

describe("toastMemoryPickEmptyReason (deprecated no-op)", () => {
  it("does not throw and returns null", () => {
    expect(toastMemoryPickEmptyReason("no_match")).toBeNull();
    expect(toastMemoryPickEmptyReason("ok")).toBeNull();
  });
});
