import { describe, expect, it } from "vitest";
import {
  basenameFromPath,
  fileManagerTypeI18nKey,
  looksLikeAbsoluteAppPath,
} from "./openAppPlatform";

describe("openAppPlatform", () => {
  it("detects absolute app paths", () => {
    expect(looksLikeAbsoluteAppPath("/Applications/Cursor.app")).toBe(true);
    expect(looksLikeAbsoluteAppPath("C:\\Programs\\Code.exe")).toBe(true);
    expect(looksLikeAbsoluteAppPath("Cursor")).toBe(false);
    expect(looksLikeAbsoluteAppPath("Visual Studio Code")).toBe(false);
  });

  it("extracts basenames", () => {
    expect(basenameFromPath("/Applications/Cursor.app")).toBe("Cursor");
    expect(basenameFromPath("C:\\Programs\\Code.exe")).toBe("Code");
  });

  it("returns platform file manager i18n keys", () => {
    expect(fileManagerTypeI18nKey("macos")).toBe("settings.typeFileManagerMac");
    expect(fileManagerTypeI18nKey("windows")).toBe(
      "settings.typeFileManagerWindows",
    );
    expect(fileManagerTypeI18nKey("linux")).toBe(
      "settings.typeFileManagerLinux",
    );
  });
});
