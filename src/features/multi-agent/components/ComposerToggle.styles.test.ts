import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const toggleSource = readFileSync(
  path.join(process.cwd(), "src/features/multi-agent/components/ComposerToggle.tsx"),
  "utf8",
);

describe("MultiAgentComposerToggle feature styles", () => {
  it("loads deferred multi-agent.css from the Shared composer entry", () => {
    // 冷启动把 multi-agent.css 留在 loadSubagentStyles；Inspector 抽屉
    // 不会在 Composer 入口挂载。入口必须自己接线，否则 pill/弹层退化为裸文本。
    // test mode 下 hook 不真调 loader，用源码契约锁住接线。
    expect(toggleSource).toContain("loadSubagentStyles");
    expect(toggleSource).toContain("useFeatureStylesReady");
    expect(toggleSource).toContain("popOpen && popPos && stylesReady");
    expect(toggleSource).toContain("open={modalOpen && stylesReady}");
  });
});
