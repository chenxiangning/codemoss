import {
  detectRendererPlatform,
  type RendererPlatform,
} from "./rendererPlatform";
import { clampUiScale, UI_SCALE_DEFAULT } from "./uiScale";

export type ApplyUiScaleTarget = {
  root: HTMLElement;
  platform: RendererPlatform;
};

/**
 * Apply uiScale — permanently locked to identity (100%).
 *
 * Field evidence (Windows WebView2 / macOS WKWebView, 2026-08):
 * 1. setZoom(uiScale≠1) freezes the renderer (multi-GB).
 * 2. body { transform:scale + width/height:100/scale% } also freezes when
 *    combined with cold-start list hydration + early pointer input.
 * 3. Product decision: UI scale feature removed; callers may still pass a
 *    number, but this module always clears residual scale styles and never
 *    applies zoom ≠ 1 (legacy settings included).
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

/** Unconditionally clear all scale-related inline properties. */
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

function applyCssPageScaleStyles(
  root: HTMLElement,
  scale: number,
  platform: RendererPlatform,
): void {
  // Scale is permanently locked to identity. Always take the full clear path
  // so residual zoom/transform from older builds (or hot-reload) is removed on
  // every platform.
  void platform;
  void scale;

  if (root.style.getPropertyValue("--ui-scale")) {
    root.style.removeProperty("--ui-scale");
  }

  const layout = resolveCssZoomLayoutTarget(root);
  if (layout !== root) {
    clearScaleLayoutStyles(root);
  }
  clearScaleLayoutStyles(layout);
  // Identity: zoom stays empty (no style.zoom write).
}

/** @internal test helper */
export function resetApplyUiScaleQueueForTests(): void {
  applyQueue = Promise.resolve();
  applyGeneration = 0;
}

let applyQueue: Promise<void> = Promise.resolve();
let applyGeneration = 0;

/**
 * Serialise applies so concurrent callers cannot reorder CSS writes.
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
  // Hard lock: ignore requested scale; always identity.
  void scale;
  applyCssPageScaleStyles(target.root, UI_SCALE_DEFAULT, target.platform);
}

/** Convenience for production hook: detect platform and clear residual scale. */
export async function applyUiScaleToDocument(
  scale: number,
  options?: {
    root?: HTMLElement;
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
    platform: options?.platform ?? detectRendererPlatform(),
  };
  if (options?.enqueue === false) {
    await applyUiScale(scale, target);
    return;
  }
  await enqueueApplyUiScale(scale, target);
}
