import { describe, expect, it } from "vitest";

import { pickLongestStageBody } from "./stageBodyText";

describe("pickLongestStageBody", () => {
  it("prefers fullOutcome over short live fragment", () => {
    const live = "Controller";
    const fullOutcome =
      "verdict: **APPROVE**\n\n- 完成了什么：确认商品 CRUD 示例接口已存在且端点齐全。\n- 关键改动：复用现有 Product Entity/Repository/Service/Controller。";
    expect(pickLongestStageBody(live, fullOutcome, "", "chip")).toBe(
      fullOutcome.trim(),
    );
  });

  it("keeps growing live text when it is the longest", () => {
    const live =
      "verdict: **APPROVE**\n\n- 完成了什么：确认商品 CRUD… streaming more tokens here";
    const fullOutcome = "verdict: **APPROVE**";
    expect(pickLongestStageBody(live, fullOutcome)).toBe(live.trim());
  });

  it("falls back to plan markdown then shortOutcome", () => {
    expect(
      pickLongestStageBody("", "", "## plan body with steps", "chip"),
    ).toBe("## plan body with steps");
    expect(pickLongestStageBody("", "", "", "chip only")).toBe("chip only");
  });

  it("ignores null/undefined/blank", () => {
    expect(pickLongestStageBody(null, undefined, "  ", "ok")).toBe("ok");
    expect(pickLongestStageBody()).toBe("");
  });

  it("does not rewrite content — only length compare after trim", () => {
    const a = "  short  ";
    const b = "longer body text";
    expect(pickLongestStageBody(a, b)).toBe("longer body text");
  });
});
