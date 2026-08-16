import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-prompt-distill export surface", () => {
  it("re-exports product Prompt Distill without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain(
      'from "../../../src/features/prompt-distill/hooks/usePromptDistillation"',
    );
    expect(ui).toContain(
      'from "../../../src/features/prompt-distill/components/PromptDistillDialog"',
    );
    const messages = readFileSync(
      join(repoRoot, "src/features/messages/components/MessagesCore.tsx"),
      "utf8",
    );
    expect(messages).toContain('from "@mossx/plugin-prompt-distill/runtime"');
    expect(messages).toContain('from "@mossx/plugin-prompt-distill/ui"');
    expect(messages).not.toContain("prompt-distill/hooks/usePromptDistillation");
  });
});
