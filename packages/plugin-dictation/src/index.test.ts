import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-dictation export surface", () => {
  it("re-exports product Dictation without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/dictation/hooks/useDictation"');
    expect(ui).toContain('from "../../../src/features/dictation/components/DictationWaveform"');
    const controller = readFileSync(
      join(repoRoot, "src/features/app/hooks/useDictationController.ts"),
      "utf8",
    );
    expect(controller).toContain('from "@mossx/plugin-dictation/runtime"');
    expect(controller).not.toContain("dictation/hooks/useDictation");
  });
});
