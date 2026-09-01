import { describe, expect, it } from "vitest";
import {
  enableOmpManifest,
  evaluateOmpExtensionUiPolicy,
  projectOmpManifest,
  type OmpExtensionOption,
} from "./ompCapabilityBoundary";

const scope = { workspaceId: "workspace-1", profileId: "profile-1" };

const extensionManifest = {
  id: "panel-extension",
  name: "Panel extension",
  version: "0.3.0",
  kind: "extension",
  entrypoint: "dist/panel.js",
  permissions: ["filesystem.read"],
} as const;

const extensionItem: OmpExtensionOption = {
  name: "panel-extension",
  path: "/workspace/.omp/extensions/panel-extension",
  description: "Renders a side panel",
  entrypoint: "dist/panel.js",
  ui: true,
};

describe("OMP extension discovery and headless/UI policy (11.3)", () => {
  it("projects extension manifests with an extension discovery entry", () => {
    const projection = projectOmpManifest(extensionManifest, scope, {
      kind: "extension",
      item: extensionItem,
    });
    expect(projection).not.toBeNull();
    expect(projection?.discovery).toEqual({ kind: "extension", item: extensionItem });
    expect(projection?.manifest.kind).toBe("extension");
  });

  it("rejects discovery entries whose kind does not match the manifest", () => {
    expect(
      projectOmpManifest(extensionManifest, scope, { kind: "extension", item: extensionItem }),
    ).not.toBeNull();
    expect(
      projectOmpManifest(
        { ...extensionManifest, kind: "skill" },
        scope,
        { kind: "extension", item: extensionItem },
      ),
    ).toBeNull();
    expect(
      projectOmpManifest(extensionManifest, scope, {
        kind: "skill",
        item: { name: "panel-extension", path: "/workspace/.omp/skills/panel-extension" },
      }),
    ).toBeNull();
  });

  it("marks extension UI degraded in headless mode and records the rationale", () => {
    const projection = projectOmpManifest(extensionManifest, scope, {
      kind: "extension",
      item: extensionItem,
    })!;
    const enabled = enableOmpManifest(projection, ["filesystem.read"]);
    const policy = evaluateOmpExtensionUiPolicy("headless", enabled);
    expect(policy.state).toBe("degraded");
    expect(policy.enabled).toBe(false);
    expect(policy.rationale).toContain("headless");
  });

  it("projects extension UI per grant in desktop WebView mode", () => {
    const projection = projectOmpManifest(extensionManifest, scope, {
      kind: "extension",
      item: extensionItem,
    })!;
    const disabledPolicy = evaluateOmpExtensionUiPolicy("desktop-webview", projection);
    expect(disabledPolicy.enabled).toBe(false);
    expect(disabledPolicy.state).toBe("unknown");

    const enabled = enableOmpManifest(projection, ["filesystem.read"]);
    const enabledPolicy = evaluateOmpExtensionUiPolicy("desktop-webview", enabled);
    expect(enabledPolicy.state).toBe("supported");
    expect(enabledPolicy.enabled).toBe(true);
  });

  it("stays fail-closed when no extension manifest is projected", () => {
    for (const mode of ["headless", "desktop-webview"] as const) {
      const policy = evaluateOmpExtensionUiPolicy(mode, null);
      expect(policy.enabled).toBe(false);
      expect(policy.state).toBe("unknown");
    }
    const skillProjection = projectOmpManifest(
      { ...extensionManifest, kind: "skill" },
      scope,
    )!;
    expect(evaluateOmpExtensionUiPolicy("desktop-webview", skillProjection).enabled).toBe(
      false,
    );
  });
});
