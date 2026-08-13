import { describe, expect, it } from "vitest";
import {
  APP_SHELL_CONSUMER_DOMAIN_SELECTION,
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
} from "../domains/appShellDomainContexts";

/**
 * T2.7 / T2.8 结构代理：
 * - 流式热字段只在 runtimeThread
 * - sidebar/git 相关 consumers 不强制订 runtimeThread（sections/render 已排除）
 * - 防止 canvas 热路径被 mid 域全量 flatten 绑死
 */

describe("appShellRenderIsolation (T2.7/T2.8 structural)", () => {
  it("keeps hot session fields owned only by runtimeThread", () => {
    for (const hot of [
      "isProcessing",
      "canInterrupt",
      "activeItems",
      "activePlan",
      "activeTurnId",
    ] as const) {
      expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeThreadContext).toContain(
        hot,
      );
      expect(
        APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.workspaceNavigationContext,
      ).not.toContain(hot);
      expect(
        APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.composerContext,
      ).not.toContain(hot);
    }
  });

  it("does not force runtimeThread into sections/render (sidebar/git mid paths)", () => {
    expect(APP_SHELL_CONSUMER_DOMAIN_SELECTION.sections).not.toContain(
      "runtimeThreadContext",
    );
    expect(APP_SHELL_CONSUMER_DOMAIN_SELECTION.render).not.toContain(
      "runtimeThreadContext",
    );
    // layoutNodes 需要 canvas 热路径，可以订 runtimeThread
    expect(APP_SHELL_CONSUMER_DOMAIN_SELECTION.layoutNodes).toContain(
      "runtimeThreadContext",
    );
  });

  it("keeps git surface out of runtimeThread (T2.8 git-only vs canvas)", () => {
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.gitSurfaceContext).toContain(
      "gitStatus",
    );
    expect(
      APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeThreadContext,
    ).not.toContain("gitStatus");
    expect(
      APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeThreadContext,
    ).not.toContain("activeDiffs");
  });
});
