import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
} from "@floating-ui/react-dom";

import { cn } from "../../lib/utils";
import { TOOLTIP_POPUP_CLASS_NAME } from "./tooltip";

export type FloatingTooltipSide = "top" | "right" | "bottom" | "left";
export type FloatingTooltipAlign = "start" | "center" | "end";

export type FloatingTooltipButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tooltipLabel: string;
    tooltipSide?: FloatingTooltipSide;
    tooltipAlign?: FloatingTooltipAlign;
    tooltipSideOffset?: number;
    tooltipClassName?: string;
    tooltipDelay?: number;
    tooltipDisabled?: boolean;
    /**
     * When set, the tooltip only opens if the matched descendant is
     * horizontally truncated (`scrollWidth > clientWidth`). Useful for
     * ellipsis labels where short text should not show a redundant bubble.
     */
    tooltipOverflowSelector?: string;
  };

const OVERFLOW_EPSILON_PX = 1;

function isHorizontallyTruncated(element: HTMLElement): boolean {
  return element.scrollWidth - element.clientWidth > OVERFLOW_EPSILON_PX;
}

function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

type FloatingTooltipPopupProps = {
  referenceElement: HTMLButtonElement;
  tooltipId: string;
  tooltipLabel: string;
  tooltipSide: FloatingTooltipSide;
  tooltipAlign: FloatingTooltipAlign;
  tooltipSideOffset: number;
  tooltipClassName?: string;
};

function FloatingTooltipPopup({
  referenceElement,
  tooltipId,
  tooltipLabel,
  tooltipSide,
  tooltipAlign,
  tooltipSideOffset,
  tooltipClassName,
}: FloatingTooltipPopupProps) {
  const placement = useMemo<Placement>(
    () =>
      tooltipAlign === "center"
        ? tooltipSide
        : `${tooltipSide}-${tooltipAlign}`,
    [tooltipAlign, tooltipSide],
  );
  const middleware = useMemo(
    () => [offset(tooltipSideOffset), flip(), shift({ padding: 8 })],
    [tooltipSideOffset],
  );
  const {
    refs,
    floatingStyles,
    placement: resolvedPlacement,
  } = useFloating({
    elements: { reference: referenceElement },
    placement,
    strategy: "fixed",
    middleware,
    whileElementsMounted: autoUpdate,
  });

  return createPortal(
    <div
      ref={refs.setFloating}
      id={tooltipId}
      role="tooltip"
      data-slot="tooltip-popup"
      data-side={resolvedPlacement.split("-")[0]}
      className={cn(TOOLTIP_POPUP_CLASS_NAME, tooltipClassName)}
      style={floatingStyles}
    >
      {tooltipLabel}
    </div>,
    document.body,
  );
}

export const FloatingTooltipButton = forwardRef<
  HTMLButtonElement,
  FloatingTooltipButtonProps
>(function FloatingTooltipButton(
  {
    tooltipLabel,
    tooltipSide = "bottom",
    tooltipAlign = "center",
    tooltipSideOffset = 6,
    tooltipClassName,
    tooltipDelay = 200,
    tooltipDisabled = false,
    tooltipOverflowSelector,
    type = "button",
    title,
    "aria-label": ariaLabel,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onKeyDown,
    onClick,
    onPointerCancel,
    onPointerDown,
    onWheel,
    disabled,
    children,
    ...buttonProps
  },
  forwardedRef,
) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const setButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const closeNow = useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);
  const isOverflowTargetTruncated = useCallback(() => {
    if (!tooltipOverflowSelector) return true;
    const root = buttonRef.current;
    if (!root) return false;
    const target = root.querySelector(tooltipOverflowSelector);
    if (!(target instanceof HTMLElement)) return false;
    return isHorizontallyTruncated(target);
  }, [tooltipOverflowSelector]);
  const scheduleOpen = useCallback(() => {
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      // Re-check at fire time: layout may have changed during the dwell.
      if (!isOverflowTargetTruncated()) return;
      setOpen(true);
    }, tooltipDelay);
  }, [clearOpenTimer, isOverflowTargetTruncated, tooltipDelay]);

  useEffect(() => clearOpenTimer, [clearOpenTimer]);
  useEffect(() => {
    if (!open) return;
    const closeWhenHidden = () => {
      if (document.visibilityState === "hidden") setOpen(false);
    };
    window.addEventListener("blur", closeNow);
    document.addEventListener("visibilitychange", closeWhenHidden);
    return () => {
      window.removeEventListener("blur", closeNow);
      document.removeEventListener("visibilitychange", closeWhenHidden);
    };
  }, [closeNow, open]);
  useEffect(() => {
    if (disabled || tooltipDisabled) closeNow();
  }, [closeNow, disabled, tooltipDisabled]);

  return (
    <>
      <button
        ref={setButtonRef}
        type={type}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={open ? tooltipId : undefined}
        disabled={disabled}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          if (!disabled && !tooltipDisabled) scheduleOpen();
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          closeNow();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (
            !disabled &&
            !tooltipDisabled &&
            isKeyboardFocus(event.currentTarget) &&
            isOverflowTargetTruncated()
          ) {
            clearOpenTimer();
            setOpen(true);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          closeNow();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Escape") closeNow();
        }}
        onClick={(event) => {
          onClick?.(event);
          closeNow();
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          closeNow();
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          closeNow();
        }}
        onWheel={(event) => {
          onWheel?.(event);
          closeNow();
        }}
        {...buttonProps}
      >
        {children}
      </button>
      {open && buttonRef.current && typeof document !== "undefined" ? (
        <FloatingTooltipPopup
          referenceElement={buttonRef.current}
          tooltipId={tooltipId}
          tooltipLabel={tooltipLabel}
          tooltipSide={tooltipSide}
          tooltipAlign={tooltipAlign}
          tooltipSideOffset={tooltipSideOffset}
          tooltipClassName={tooltipClassName}
        />
      ) : null}
    </>
  );
});
