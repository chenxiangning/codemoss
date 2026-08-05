import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";

const SPLIT_RATIO_KEY = "conversationInspectorSplitRatio";
const LEGACY_SPLIT_RATIO_KEY = "subagentChatSplitRatio";
const DEFAULT_RATIO = 58;
const MIN_RATIO = 36;
const MAX_RATIO = 78;

function clampRatio(value: number) {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}

function readStoredRatio() {
  const stored =
    getClientStoreSync<number>("layout", SPLIT_RATIO_KEY) ??
    getClientStoreSync<number>("layout", LEGACY_SPLIT_RATIO_KEY);
  return typeof stored === "number" && Number.isFinite(stored)
    ? clampRatio(stored)
    : DEFAULT_RATIO;
}

type ConversationInspectorSplitProps = {
  messagesNode: ReactNode;
  conversationSurface?: ReactNode;
  composerNode: ReactNode | null;
  open: boolean;
  inspectorNode: ReactNode;
  resizeLabel: string;
  onRequestClose?: () => void;
};

export const ConversationInspectorSplit = memo(
  function ConversationInspectorSplit({
    messagesNode,
    conversationSurface,
    composerNode,
    open,
    inspectorNode,
    resizeLabel,
    onRequestClose,
  }: ConversationInspectorSplitProps) {
    const splitRootRef = useRef<HTMLDivElement | null>(null);
    const ratioRef = useRef(readStoredRatio());
    const cleanupRef = useRef<(() => void) | null>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(false);

    const applyRatio = useCallback((ratio: number, persist: boolean) => {
      const next = clampRatio(ratio);
      ratioRef.current = next;
      splitRootRef.current?.style.setProperty(
        "--subagent-chat-split-ratio",
        next.toFixed(2),
      );
      const divider = splitRootRef.current?.querySelector<HTMLElement>(
        ".subagent-chat-split-divider",
      );
      divider?.setAttribute("aria-valuenow", next.toFixed(2));
      if (persist) writeClientStoreValue("layout", SPLIT_RATIO_KEY, next);
    }, []);

    useEffect(() => {
      return () => {
        cleanupRef.current?.();
        document.body.classList.remove("subagent-chat-split-resizing");
      };
    }, []);

    useEffect(() => {
      if (open && !wasOpenRef.current) {
        restoreFocusRef.current =
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== document.body
            ? document.activeElement
            : null;
        requestAnimationFrame(() => {
          splitRootRef.current
            ?.querySelector<HTMLElement>("[data-inspector-initial-focus]")
            ?.focus();
        });
      } else if (!open && wasOpenRef.current) {
        const capturedFocus = restoreFocusRef.current;
        const returnFocus =
          capturedFocus?.isConnected === true
            ? capturedFocus
            : splitRootRef.current?.querySelector<HTMLElement>(
                "[data-inspector-return-focus]",
              );
        returnFocus?.focus();
        restoreFocusRef.current = null;
      }
      wasOpenRef.current = open;
      if (open) applyRatio(ratioRef.current, false);
    }, [applyRatio, open]);

    useEffect(() => {
      if (!open || window.matchMedia("(min-width: 721px)").matches) return;
      const root = splitRootRef.current;
      const drawer = root?.querySelector<HTMLElement>(
        ".subagent-inspector-drawer",
      );
      if (!drawer) return;
      const handleKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onRequestClose?.();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          drawer.querySelectorAll<HTMLElement>(
            '[data-inspector-initial-focus], button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      drawer.addEventListener("keydown", handleKeyDown);
      return () => drawer.removeEventListener("keydown", handleKeyDown);
    }, [onRequestClose, open]);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const root = splitRootRef.current;
        const main = root?.querySelector<HTMLElement>(
          ".subagent-chat-split-main",
        );
        const side = root?.querySelector<HTMLElement>(
          ".subagent-inspector-drawer",
        );
        if (!root || !main || !side) return;
        const mainRect = main.getBoundingClientRect();
        const totalWidth = mainRect.width + side.getBoundingClientRect().width;
        if (totalWidth <= 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startMainWidth = mainRect.width;
        const minMain = Math.max(280, totalWidth * (MIN_RATIO / 100));
        const maxMain = Math.min(
          totalWidth - 260,
          totalWidth * (MAX_RATIO / 100),
        );
        if (maxMain <= minMain) return;
        document.body.classList.add("subagent-chat-split-resizing");
        const cleanup = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          document.body.classList.remove("subagent-chat-split-resizing");
          applyRatio(ratioRef.current, true);
          cleanupRef.current = null;
        };
        const onMove = (moveEvent: PointerEvent) => {
          const width = Math.min(
            maxMain,
            Math.max(minMain, startMainWidth + moveEvent.clientX - startX),
          );
          applyRatio((width / totalWidth) * 100, false);
        };
        const onUp = () => cleanup();
        cleanupRef.current?.();
        cleanupRef.current = cleanup;
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      },
      [applyRatio],
    );

    const handleDividerKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        const delta = event.shiftKey ? 5 : 2;
        if (event.key === "ArrowLeft")
          applyRatio(ratioRef.current - delta, true);
        else if (event.key === "ArrowRight")
          applyRatio(ratioRef.current + delta, true);
        else if (event.key === "Home") applyRatio(MIN_RATIO, true);
        else if (event.key === "End") applyRatio(MAX_RATIO, true);
        else return;
        event.preventDefault();
      },
      [applyRatio],
    );

    return (
      <div
        ref={splitRootRef}
        className={cn("subagent-chat-split", open ? "is-open" : "is-closed")}
        style={
          {
            ["--subagent-chat-split-ratio" as string]:
              ratioRef.current.toFixed(2),
          } as CSSProperties
        }
      >
        <div className="subagent-chat-split-main">
          {messagesNode}
          {conversationSurface}
          {composerNode}
        </div>
        {open ? (
          <>
            <div
              className="subagent-chat-split-divider"
              role="separator"
              aria-orientation="vertical"
              aria-label={resizeLabel}
              aria-valuemin={MIN_RATIO}
              aria-valuemax={MAX_RATIO}
              aria-valuenow={ratioRef.current}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onKeyDown={handleDividerKeyDown}
              onDoubleClick={() => applyRatio(DEFAULT_RATIO, true)}
            />
            {inspectorNode}
          </>
        ) : null}
      </div>
    );
  },
);
