import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-notes export surface", () => {
  it("re-exports product Notes without moving source or migrating note_cards", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/note-cards/services/noteCardsFacade"');
    expect(ui).toContain('from "../../../src/features/note-cards/components/WorkspaceNoteCardPanel"');
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-notes/ui"');
    expect(layout).toContain('from "@mossx/plugin-notes/runtime"');
    expect(layout).not.toContain("note-cards/components/WorkspaceNoteCardPanel");
    const messaging = readFileSync(
      join(repoRoot, "src/features/threads/hooks/useThreadMessaging.ts"),
      "utf8",
    );
    expect(messaging).toContain('from "@mossx/plugin-notes/runtime"');
    expect(messaging).not.toContain("@mossx/plugin-notes/ui");
    expect(messaging).not.toContain("note-cards/");
    expect(existsSync(join(repoRoot, "src-tauri/src/note_cards.rs"))).toBe(true);
  });
});
