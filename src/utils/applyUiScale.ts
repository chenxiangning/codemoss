import {
  detectRendererPlatform,
  type RendererPlatform,
} from "./rendererPlatform";
import { clampUiScale } from "./uiScale";

export type ApplyUiScaleTarget = {
  root: HTMLElement;
  setNativeZoom?: (factor: number) => Promise<void>;
  platform: RendererPlatform;
};

/**
 * Apply uiScale without native WebView zoom ≠1.
 *
 * Field evidence (Windows WebView2, 2026-08):
 * 1. setZoom(uiScale≠1) freezes the renderer (multi-GB).
 * 2. body { transform:scale + width/height:100/scale% } also freezes when
 *    combined with cold-start list hydration + early pointer input.
 *
 * Current strategy: CSS `zoom` only (layout-participating, no expanded
 * pre-transform surface). Native zoom is pinned to 1 once per session.
 *
 * Shell: html/body/#root/.app use a % height chain (base.css), not 100vh.
 */
export function usesCssPageZoom(_platform: RendererPlatform): boolean {
  return true;
}

/**
 * Transform layout-fill path is retired (WebView2 memory bomb).
 * Always null so callers clear width/height.
 *
 * @internal exported for unit tests
 */
export function cssZoomLayoutFillSize(scale: number): string | null {
  void clampUiScale(scale);
  return null;
}

/**
 * Prefer <body> when root is <html>; keep detached test roots as-is.
 *
 * @internal exported for unit tests
 */
export function resolveCssZoomLayoutTarget(root: HTMLElement): HTMLElement {
  const doc = root.ownerDocument;
  if (doc?.documentElement === root && doc.body) {
    return doc.body;
  }
  return root;
}

function clearScaleLayoutStyles(el: HTMLElement): void {
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
}

/**
 * CSS zoom only. Always strips residual transform/fill from older builds.
 */
function setScaleLayoutStyles(el: HTMLElement, scale: number): void {
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.width = "";
  el.style.height = "";
  el.style.position = "";
  el.style.top = "";
  el.style.left = "";
  el.style.right = "";
  el.style.bottom = "";

  if (scale === 1) {
    el.style.zoom = "";
    return;
  }

  el.style.zoom = String(scale);
}

function applyCssPageScaleStyles(root: HTMLElement, scale: number): void {
  root.style.setProperty("--ui-scale", String(scale));

  const layout = resolveCssZoomLayoutTarget(root);
  if (layout !== root) {
    clearScaleLayoutStyles(root);
  }
  setScaleLayoutStyles(layout, scale);
}

/** After first successful pin to 1, skip further setZoom(1). */
let nativeIdentityPinned = false;

/** @internal test helper */
export function resetUiScaleNativePinForTests(): void {
  nativeIdentityPinned = false;
  applyQueue = Promise.resolve();
  applyGeneration = 0;
}

let applyQueue: Promise<void> = Promise.resolve();
let applyGeneration = 0;

/**
 * Serialise applies so rapid shortcut spam cannot reorder CSS/native writes.
 * Stale generations are skipped after they reach the head of the queue.
 */
export function enqueueApplyUiScale(
  scale: number,
  target: ApplyUiScaleTarget,
): Promise<void> {
  const generation = ++applyGeneration;
  const run = async () => {
    if (generation !== applyGeneration) {
      return;
    }
    await applyUiScale(scale, target);
  };
  applyQueue = applyQueue.then(run, run);
  return applyQueue;
}

export async function applyUiScale(
  scale: number,
  target: ApplyUiScaleTarget,
): Promise<void> {
  const next = clampUiScale(scale);

  applyCssPageScaleStyles(target.root, next);
  if (target.setNativeZoom && !nativeIdentityPinned) {
    await target.setNativeZoom(1);
    nativeIdentityPinned = true;
  }
}

/** Convenience for production hook: detect platform + optional native zoom. */
export async function applyUiScaleToDocument(
  scale: number,
  options?: {
    root?: HTMLElement;
    setNativeZoom?: (factor: number) => Promise<void>;
    platform?: RendererPlatform;
    /** default true — use serial queue */
    enqueue?: boolean;
  },
): Promise<void> {
  const root = options?.root ?? globalThis.document?.documentElement;
  if (!root) {
    return;
  }
  const target: ApplyUiScaleTarget = {
    root,
    setNativeZoom: options?.setNativeZoom,
    platform: options?.platform ?? detectRendererPlatform(),
  };
  if (options?.enqueue === false) {
    await applyUiScale(scale, target);
    return;
  }
  await enqueueApplyUiScale(scale, target);
}
