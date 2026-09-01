import { describe, expect, it, vi } from "vitest";
import {
  normalizeOmpProviderProfile,
  resolveOmpProviderSessionBinding,
} from "./ompProviderProfile";

vi.mock("@/services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

describe("OMP provider profile", () => {
  it("requires explicit valid id and name", () => {
    expect(normalizeOmpProviderProfile({ binaryPath: "/opt/omp" })).toBeNull();
    expect(
      normalizeOmpProviderProfile({
        binaryPath: "/opt/omp",
        profileId: "team.local",
        profileName: "Team local",
      }),
    ).toEqual({
      binaryPath: "/opt/omp",
      profileId: "team.local",
      profileName: "Team local",
    });
  });

  it("fails closed for malformed profile metadata instead of inferring identity", () => {
    expect(
      resolveOmpProviderSessionBinding({
        binaryPath: null,
        profileId: "",
        profileName: "Team local",
      }),
    ).toBeNull();
    expect(resolveOmpProviderSessionBinding(null)).toBeNull();
  });

  it("binds normalized metadata to the OMP local sentinel identity", () => {
    // 自定义 profileId 只是显示元数据；binding id 恒为本地 sentinel，
    // 防止它进入 target/catalog 链路被 omp models 当位置参数查询。
    expect(
      resolveOmpProviderSessionBinding({
        binaryPath: "/opt/omp",
        profileId: " team.local ",
        profileName: " Team local ",
      }),
    ).toEqual({
      id: "__omp_local__",
      name: "Team local",
      source: "managed",
    });
  });
});
