export function applyUserMessageBubbleCssVars(color: string | null, textColor: string | null) {
  if (typeof document === "undefined") {
    return;
  }
  const targets: HTMLElement[] = [
    document.documentElement,
    ...(Array.from(document.querySelectorAll(".app")) as HTMLElement[]),
  ];
  targets.forEach((target) => {
    if (color) {
      target.style.setProperty("--surface-bubble-user", color);
      target.style.setProperty("--color-message-user-bg", color);
      if (textColor) {
        target.style.setProperty("--color-message-user-text", textColor);
      }
      return;
    }
    target.style.removeProperty("--surface-bubble-user");
    target.style.removeProperty("--color-message-user-bg");
    target.style.removeProperty("--color-message-user-text");
  });
}
