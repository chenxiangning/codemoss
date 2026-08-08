/**
 * Portal 弹层（如协作模板管理）DOM 挂在 body，但 React 树仍可能是 Composer 子孙。
 * 合成 click 冒泡到 chat-input-box 时，若无脑 focus 会抢走弹层内 input 焦点。
 *
 * 命中 guard 选择器则跳过 shell 抢焦。
 */
export const COMPOSER_PORTAL_FOCUS_GUARD_SELECTOR =
  "[data-composer-portal-focus-guard], .ma-tpl-overlay";

export function shouldSkipComposerShellFocus(
  target: EventTarget | null,
): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(COMPOSER_PORTAL_FOCUS_GUARD_SELECTOR));
}
