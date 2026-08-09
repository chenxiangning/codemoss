import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";

export type ConversationScrollEdge = "top" | "bottom";

interface ScrollControlProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onRequestScrollToEdge: (edge: ConversationScrollEdge) => void;
}

// 距底阈值(px)：小于此值视为「已在底部」，隐藏按钮。
const THRESHOLD = 100;
// 停止滚动后延迟隐藏的时间(ms)。
const HIDE_DELAY = 1500;
/**
 * ScrollControl —— 跟随滚轮方向出现的快捷滚动浮标（交互逻辑移植自
 * idea-claude-code-gui 的 ScrollControl）：
 * - 向上滚时显示「回到顶部」箭头，点击滚到顶部
 * - 向下滚时显示「回到底部」箭头，点击滚到底部
 * - 已在底部 / 内容不足一屏 / 停止滚动 1.5s 后自动隐藏
 *
 * 「显示」只由用户主动 wheel 触发，scroll 事件只负责「到底了就藏起来」——
 * 这样程序化的自动跟随滚动不会误触发浮标。
 *
 * 按钮只上报 top/bottom intent；真正回底走 Messages 的 resumeFollowAndSmoothPin
 * （用户主动导航与回顶对称 smooth；send / history-open 仍走瞬时 resumeFollowAndPin）。
 *
 * ponytail: 定位从原项目的 position:fixed + inputAreaRef + getAppViewport()
 * zoom 补偿，简化为相对 .messages-shell(已 position:relative) 的 absolute 固定
 * 右下角。原方案是 IntelliJ JCEF 的 CSS zoom 专用补偿，Tauri 无此问题；且本
 * 项目输入框不在 Messages 组件内，拿不到 inputAreaRef。
 *
 * 性能：本地 state（不进根渲染链），scroll/wheel 均 passive + rAF 节流，
 * setVisible 同值时 React 自动 bail，符合仓库性能红线。
 */
export const ScrollControl = memo(({ containerRef, onRequestScrollToEdge }: ScrollControlProps) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 检查滚动位置：内容不足一屏或已在底部时隐藏。仅隐藏、从不主动显示。
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) {
      setVisible(false);
      return;
    }

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom < THRESHOLD) {
      setVisible(false);
    }
  }, [containerRef]);

  // 滚轮事件是唯一「显示」入口：据 deltaY 定方向并起隐藏计时器。
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight <= clientHeight) return;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < THRESHOLD) {
        setVisible(false);
        return;
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      // deltaY > 0 向下滚 → 回底箭头；deltaY < 0 向上滚 → 回顶箭头。
      if (e.deltaY > 0) {
        setDirection("down");
      } else if (e.deltaY < 0) {
        setDirection("up");
      }

      setVisible(true);
      hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY);
    },
    [containerRef],
  );

  const handleClick = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    onRequestScrollToEdge(direction === "up" ? "top" : "bottom");
    setVisible(false);
  }, [containerRef, direction, onRequestScrollToEdge]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    checkScrollPosition();

    // scroll 监听经 rAF 节流，passive 不阻塞滚动。
    let scrollRafId: number | null = null;
    const handleScroll = () => {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        checkScrollPosition();
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", checkScrollPosition);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [checkScrollPosition, containerRef, handleWheel]);

  if (!visible) return null;

  const label =
    direction === "up" ? t("messages.backToTop") : t("messages.backToBottom");

  return (
    <button
      type="button"
      className="scroll-control-button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      data-testid="messages-scroll-control"
    >
      {direction === "up" ? (
        <ArrowUp size={17} aria-hidden />
      ) : (
        <ArrowDown size={17} aria-hidden />
      )}
    </button>
  );
});

ScrollControl.displayName = "ScrollControl";
