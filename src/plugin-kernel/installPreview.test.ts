import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import notesPilot from "../../packages/plugin-contract/fixtures/valid/notes-pilot.json";
import { parseManifestV1 } from "./parseManifestV1";
import { previewInstall, validateRegistration } from "./installPreview";
import type { ParseManifestOptions } from "./types";

const currentDir = dirname(fileURLToPath(import.meta.url));
const systemOpts: ParseManifestOptions = {
  trustTier: "system",
  currentPlatform: "darwin-arm64",
  coreContract: "1.0.0",
  startupAllowlist: ["com.mossx.notes"],
};

describe("installPreview", () => {
  it("projects declared contributions without loading entries", () => {
    const parsed = parseManifestV1(notesPilot, systemOpts);
    expect(parsed.ok).toBe(true);
    const preview = previewInstall(parsed.manifest!);
    expect(preview.pluginId).toBe("com.mossx.notes");
    expect(preview.loadsEntries).toBe(false);
    expect(preview.contributions.some((item) => item.id === "notes.main")).toBe(true);
    expect(preview.permissionDiff).toContain("mossx.storage.readwrite");
    expect(preview.contributions.every((item) => !("path" in item))).toBe(true);
  });

  it("rejects undeclared runtime registration", () => {
    const parsed = parseManifestV1(notesPilot, systemOpts);
    const result = validateRegistration(parsed.manifest!, {
      contributions: ["notes.main", "notes.undeclared"],
      capabilities: ["mossx.storage.readwrite", "mossx.filesystem.raw"],
    });
    expect(result.ok).toBe(false);
    expect(result.visibleContributions).toEqual(["notes.main"]);
    expect(result.visibleCapabilities).toEqual(["mossx.storage.readwrite"]);
    expect(result.rejected).toEqual([
      { kind: "contribution", id: "notes.undeclared" },
      { kind: "capability", id: "mossx.filesystem.raw" },
    ]);
  });

  it("does not import filesystem APIs in the preview module", () => {
    const source = readFileSync(join(currentDir, "installPreview.ts"), "utf8");
    expect(source).not.toMatch(/node:fs|readFileSync|fs\.promises|spawn|child_process/);
  });
});
