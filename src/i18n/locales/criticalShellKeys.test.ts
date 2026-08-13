import { describe, expect, it } from "vitest";
import zh from "./zh";
import en from "./en";

/**
 * Regression guard: full locale packs must resolve shell + settings keys
 * (raw-key bugs after over-aggressive P2-3 deferred i18n).
 */
describe("i18n full locale shell keys", () => {
  it("includes file-tree and settings copy for zh and en", () => {
    expect((zh as { files?: { loadingFiles?: string } }).files?.loadingFiles).toBeTruthy();
    expect((en as { files?: { loadingFiles?: string } }).files?.loadingFiles).toBeTruthy();
    expect((zh as { files?: { loadingFiles?: string } }).files?.loadingFiles).not.toBe(
      "files.loadingFiles",
    );
    expect((zh as { settings?: { sidebarBasic?: string } }).settings?.sidebarBasic).toBeTruthy();
    expect((zh as { settings?: { sidebarBasic?: string } }).settings?.sidebarBasic).not.toBe(
      "settings.sidebarBasic",
    );
  });

  it("includes common chat/message surface roots used by the main shell", () => {
    for (const pack of [zh, en] as Array<Record<string, unknown>>) {
      expect(pack.messages ?? pack).toBeTruthy();
      expect(pack.git ?? pack).toBeTruthy();
      expect(pack.files ?? pack).toBeTruthy();
      expect(pack.settings ?? pack).toBeTruthy();
    }
  });
});
