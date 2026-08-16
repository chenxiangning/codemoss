import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-vendors export surface", () => {
  it("re-exports product Vendors without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/vendors/activateEngineProviderProfile"');
    expect(ui).toContain('from "../../../src/features/vendors/components/VendorModelManagerDialogHost"');
    const render = readFileSync(join(repoRoot, "src/app-shell/render/renderAppShell.tsx"), "utf8");
    expect(render).toContain('from "@mossx/plugin-vendors/ui"');
    expect(render).not.toContain("features/vendors/components/VendorModelManagerDialogHost");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/SettingsView.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-vendors/ui"');
    expect(settings).not.toContain("vendors/components/VendorSettingsPanel");
  });
});
