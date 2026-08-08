// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyUiScale,
  cssZoomLayoutFillSize,
  enqueueApplyUiScale,
  resetUiScaleNativePinForTests,
  resolveCssZoomLayoutTarget,
  usesCssPageZoom,
} from "./applyUiScale";
import type { RendererPlatform } from "./rendererPlatform";

function makeRoot(): HTMLElement {
  return document.createElement("div");
}

function clearEl(el: HTMLElement): void {
  el.style.zoom = "";
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.width = "";
  el.style.height = "";
  el.style.position = "";
  el.style.top = "";
  el.style.left = "";
  el.style.right = "";
  el.style.bottom = "";
  el.style.removeProperty("--ui-scale");
}

beforeEach(() => {
  resetUiScaleNativePinForTests();
  clearEl(document.documentElement);
  clearEl(document.body);
});

describe("usesCssPageZoom", () => {
  it.each<[RendererPlatform, boolean]>([
    ["windows", true],
    ["unknown", true],
    ["macos", true],
    ["linux", true],
  ])("platform %s → %s (unified CSS path)", (platform, expected) => {
    expect(usesCssPageZoom(platform)).toBe(expected);
  });
});

describe("cssZoomLayoutFillSize", () => {
  it("returns null — transform fill path retired", () => {
    expect(cssZoomLayoutFillSize(1)).toBeNull();
    expect(cssZoomLayoutFillSize(0.8)).toBeNull();
    expect(cssZoomLayoutFillSize(1.25)).toBeNull();
  });
});

describe("resolveCssZoomLayoutTarget", () => {
  it("routes documentElement to body", () => {
    expect(resolveCssZoomLayoutTarget(document.documentElement)).toBe(
      document.body,
    );
  });

  it("keeps non-html roots (unit-test divs)", () => {
    const root = makeRoot();
    expect(resolveCssZoomLayoutTarget(root)).toBe(root);
  });
});

describe("applyUiScale", () => {
  it("windows: CSS zoom only, native zoom pinned to 1 once", async () => {
    const root = makeRoot();
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.1, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("1.1");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(root.style.height).toBe("");
    expect(root.style.position).toBe("");
    expect(root.style.getPropertyValue("--ui-scale")).toBe("1.1");
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
    expect(setNativeZoom).toHaveBeenCalledWith(1);

    await applyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("0.8");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
  });

  it("windows documentElement: zooms body and clears residual html transform", async () => {
    document.documentElement.style.zoom = "0.8";
    document.documentElement.style.width = "125%";
    document.documentElement.style.transform = "scale(0.8)";

    await applyUiScale(0.8, {
      root: document.documentElement,
      platform: "windows",
    });

    expect(document.documentElement.style.zoom).toBe("");
    expect(document.documentElement.style.width).toBe("");
    expect(document.documentElement.style.transform).toBe("");
    expect(document.body.style.zoom).toBe("0.8");
    expect(document.body.style.transform).toBe("");
  });

  it("windows: scale 1 clears zoom and leftover transform fill", async () => {
    const root = makeRoot();
    root.style.zoom = "0.8";
    root.style.width = "125%";
    root.style.transform = "scale(0.8)";
    root.style.position = "fixed";
    await applyUiScale(1, {
      root,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(root.style.position).toBe("");
  });

  it("enqueueApplyUiScale serializes and keeps latest scale", async () => {
    const root = makeRoot();
    const order: number[] = [];
    const setNativeZoom = vi.fn(async (factor: number) => {
      order.push(factor);
      await new Promise((r) => setTimeout(r, 5));
    });
    const slow = enqueueApplyUiScale(1.2, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    const fast = enqueueApplyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    await Promise.all([slow, fast]);
    expect(root.style.zoom).toBe("0.8");
    expect(root.style.transform).toBe("");
    expect(order[order.length - 1]).toBe(1);
  });

  it("macos/linux: CSS zoom + native pin 1", async () => {
    for (const platform of ["macos", "linux"] as const) {
      resetUiScaleNativePinForTests();
      const root = makeRoot();
      const setNativeZoom = vi.fn(async () => undefined);
      await applyUiScale(0.8, { root, setNativeZoom, platform });
      expect(root.style.zoom).toBe("0.8");
      expect(root.style.transform).toBe("");
      expect(setNativeZoom).toHaveBeenCalledWith(1);
      expect(setNativeZoom).not.toHaveBeenCalledWith(0.8);
    }
  });
});
