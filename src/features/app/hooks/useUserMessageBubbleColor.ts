import { useEffect } from "react";
import { normalizeHexColor, getContrastingTextColor } from "../../../utils/colorUtils";
import { applyUserMessageBubbleCssVars } from "../../../utils/userMessageBubbleCssVars";

export function useUserMessageBubbleColor(userMsgColor: string) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const normalized = normalizeHexColor(userMsgColor);

    if (normalized) {
      applyUserMessageBubbleCssVars(normalized, getContrastingTextColor(normalized));
      try {
        window.localStorage.setItem("userMsgColor", normalized);
      } catch {
        // ignore localStorage write failures
      }
      return;
    }

    applyUserMessageBubbleCssVars(null, null);
    try {
      window.localStorage.removeItem("userMsgColor");
    } catch {
      // ignore localStorage write failures
    }
  }, [userMsgColor]);
}
