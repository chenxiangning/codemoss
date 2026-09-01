// executionTarget 纯函数层测试：OMP 本地单渠道归一 + 其它引擎不回归。
import { describe, expect, it } from "vitest";

import {
  CODEX_DISK_PROVIDER_PROFILE_ID,
  OMP_LOCAL_PROVIDER_PROFILE_ID,
} from "../../../../../threads/constants/codexProviderProfiles";
import { normalizeExecutionProviderProfileId } from "./executionTarget";

describe("normalizeExecutionProviderProfileId", () => {
  it.each([
    undefined,
    null,
    "",
    OMP_LOCAL_PROVIDER_PROFILE_ID,
    "user-saved-custom-id",
  ])("normalizes OMP profile id %j to the local default (null)", (id) => {
    // 自定义 id 不是 OMP 的 provider；透传给 `omp models` 会静默返回空目录。
    expect(normalizeExecutionProviderProfileId("omp", id)).toBeNull();
  });

  it("normalizes the local default id of other engines to null", () => {
    expect(
      normalizeExecutionProviderProfileId("codex", CODEX_DISK_PROVIDER_PROFILE_ID),
    ).toBeNull();
  });

  it("preserves non-local profile ids of other engines", () => {
    expect(normalizeExecutionProviderProfileId("codex", "codex-b")).toBe(
      "codex-b",
    );
  });
});
