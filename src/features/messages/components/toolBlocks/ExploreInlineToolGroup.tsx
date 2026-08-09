/**
 * 探索/批量工具分组壳层（explore-inline）
 * 与「批量读取文件」同构：图标 + 标题头可折叠，左侧 rail 缩进列表行。
 * Read / Search 等分组共用，避免各 Block 各自复制 DOM 与 class 结构。
 *
 * 图标尺寸：壳层强制归一到 14px（与 thinking / 单工具 Marker 行一致），
 * 避免 FileText 等仅写 size={14} 仍与 Search 观感不一致。
 */
import {
  cloneElement,
  isValidElement,
  memo,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import { TOOL_META_ICON_PX } from "../../../../components/common/ToolMarkerShell";

function normalizeExploreIcon(icon: ReactNode): ReactNode {
  if (!isValidElement(icon)) {
    return icon;
  }
  const el = icon as ReactElement<{ className?: string; size?: number | string }>;
  return cloneElement(el, {
    size: TOOL_META_ICON_PX,
    className: cn("size-3.5 shrink-0", el.props.className),
    "aria-hidden": true,
  } as Partial<typeof el.props> & { "aria-hidden": true });
}

export type ExploreInlineToolGroupProps = {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** 默认展开，与历史 Read/Search 分组行为一致 */
  defaultExpanded?: boolean;
  className?: string;
  listRef?: Ref<HTMLDivElement>;
  listClassName?: string;
};

export type ExploreInlineItemRowProps = {
  kind?: string;
  /** 文件类型图标等前缀节点（插在 kind 与 label 之间） */
  icon?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  title?: string;
  className?: string;
};

export const ExploreInlineToolGroup = memo(function ExploreInlineToolGroup({
  icon,
  title,
  children,
  defaultExpanded = true,
  className,
  listRef,
  listClassName,
}: ExploreInlineToolGroupProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "tool-inline explore-inline is-collapsible",
        !isExpanded && "is-collapsed",
        className,
      )}
    >
      <div className="tool-inline-content">
        <div className="explore-inline-header">
          <button
            type="button"
            className="explore-inline-header-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={`${title} · ${t("messages.toggleDetails")}`}
          >
            <span className="explore-inline-icon" aria-hidden>
              {normalizeExploreIcon(icon)}
            </span>
            <span className="explore-inline-title" title={title}>
              {title}
            </span>
          </button>
        </div>
        {/* 统一折叠动画；关合后卸载列表，避免隐藏节点 + flex gap 抖动 */}
        <CollapsibleReveal open={isExpanded}>
          <div
            ref={listRef}
            className={cn("explore-inline-list", listClassName)}
          >
            {children}
          </div>
        </CollapsibleReveal>
      </div>
    </div>
  );
});

export const ExploreInlineItemRow = memo(function ExploreInlineItemRow({
  kind,
  icon,
  label,
  detail,
  title,
  className,
}: ExploreInlineItemRowProps) {
  return (
    <div
      className={cn("explore-inline-item", icon != null && "has-file-icon", className)}
      title={title}
    >
      {kind ? <span className="explore-inline-kind">{kind}</span> : null}
      {icon != null ? (
        <span className="explore-inline-file-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="explore-inline-label">{label}</span>
      {detail ? <span className="explore-inline-detail">{detail}</span> : null}
    </div>
  );
});
