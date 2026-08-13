import { useTranslation } from "react-i18next";
import Copy from "lucide-react/dist/esm/icons/copy";
import LinkIcon from "lucide-react/dist/esm/icons/link";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import { cn } from "../../../../lib/utils";
import { ThreadDeleteConfirmBubble } from "../../../threads/components/ThreadDeleteConfirmBubble";
import type { IntentCanvasIndexEntry } from "../../types";
import { formatRelativeCanvasTime } from "../../utils/relativeTime";
import type { CanvasStaleBadge } from "../../utils/staleSignals";

export type IntentCanvasCardAction = "open" | "duplicate" | "delete";

export type IntentCanvasCardActionPrompt = {
  action: IntentCanvasCardAction;
  entry: IntentCanvasIndexEntry;
};

export type IntentCanvasHomeCardProps = {
  entry: IntentCanvasIndexEntry;
  isSelected: boolean;
  isStaleEra: boolean;
  staleBadge: CanvasStaleBadge | null;
  now: Date;
  actionPrompt: IntentCanvasCardActionPrompt | null;
  isConfirming: boolean;
  onToggleSelection: (canvasId: string) => void;
  onActionRequest: (entry: IntentCanvasIndexEntry, action: IntentCanvasCardAction) => void;
  onConfirmAction: () => void;
  onCancelAction: () => void;
};

const MODE_LABEL_KEYS = {
  architect: "intentCanvas.manager.modeArchitect",
  spotlight: "intentCanvas.manager.modeSpotlight",
  file: "intentCanvas.manager.modeFile",
} as const;

function PlaceholderThumbnail() {
  return (
    <svg
      className="intent-canvas-thumb-placeholder"
      viewBox="0 0 280 88"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3">
        <circle cx="140" cy="44" r="6" />
        <circle cx="85" cy="28" r="4" />
        <circle cx="195" cy="60" r="4" />
      </g>
    </svg>
  );
}

export function IntentCanvasHomeCard({
  entry,
  isSelected,
  isStaleEra,
  staleBadge,
  now,
  actionPrompt,
  isConfirming,
  onToggleSelection,
  onActionRequest,
  onConfirmAction,
  onCancelAction,
}: IntentCanvasHomeCardProps) {
  const { t } = useTranslation();
  const isActionPromptOpen = actionPrompt?.entry.id === entry.id;

  const staleBadgeText = staleBadge
    ? staleBadge.kind === "anchors-broken"
      ? t("intentCanvas.manager.staleAnchorsBroken")
      : staleBadge.kind === "empty-graph"
        ? t("intentCanvas.manager.staleEmpty")
        : t("intentCanvas.manager.staleInactive", { days: staleBadge.days })
    : null;

  return (
    <article
      className={cn("intent-canvas-home-card", isSelected && "is-selected")}
      role="listitem"
    >
      <button
        type="button"
        className="intent-canvas-home-card-open"
        onClick={() => onActionRequest(entry, "open")}
      >
        <span className="intent-canvas-thumb">
          {entry.thumbnailSvg ? (
            <span
              className="intent-canvas-thumb-svg"
              // 内容来自本应用保存时自生成的 exportToSvg 输出，非外部输入。
              dangerouslySetInnerHTML={{ __html: entry.thumbnailSvg }}
            />
          ) : (
            <PlaceholderThumbnail />
          )}
        </span>
        <span className="intent-canvas-home-card-body">
          <h3>
            {entry.title}
            {isStaleEra && staleBadgeText ? (
              <span className="intent-canvas-stale-tag">{staleBadgeText}</span>
            ) : null}
          </h3>
          <p>{entry.summary || t("intentCanvas.manager.noSummary")}</p>
        </span>
        <span className="intent-canvas-home-card-foot">
          <span className={cn("intent-canvas-mode-badge", `is-${entry.mode}`)}>
            {t(MODE_LABEL_KEYS[entry.mode])}
          </span>
          <span className="intent-canvas-stat-inline">
            <b>{entry.elementCount}</b>·<b>{entry.linkedFileCount}</b>·<b>{entry.linkedProjectMapNodeCount}</b>
          </span>
          <span className="intent-canvas-foot-spacer" />
          <span className="intent-canvas-time">
            {formatRelativeCanvasTime(entry.updatedAt, now, t)}
          </span>
        </span>
      </button>
      <label className="intent-canvas-home-card-selection">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(entry.id)}
          aria-label={t("intentCanvas.manager.selectCanvas", { title: entry.title })}
        />
      </label>
      <div className="intent-canvas-card-actions">
        <button
          type="button"
          onClick={() => onActionRequest(entry, "duplicate")}
          aria-label={t("intentCanvas.manager.duplicate")}
          title={t("intentCanvas.manager.duplicate")}
        >
          <Copy aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onActionRequest(entry, "open")}
          aria-label={t("intentCanvas.manager.open")}
          title={t("intentCanvas.manager.open")}
        >
          <LinkIcon aria-hidden />
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={() => onActionRequest(entry, "delete")}
          aria-label={t("intentCanvas.manager.delete")}
          title={t("intentCanvas.manager.delete")}
        >
          <Trash2 aria-hidden />
        </button>
      </div>
      {isActionPromptOpen && actionPrompt ? (
        <div className="intent-canvas-action-popover-shell">
          <ThreadDeleteConfirmBubble
            threadName={entry.title}
            title={t(`intentCanvas.manager.${actionPrompt.action}`)}
            message={t(`intentCanvas.manager.${actionPrompt.action}Confirm`, { title: entry.title })}
            hint={t(`intentCanvas.manager.${actionPrompt.action}Hint`)}
            confirmLabel={t(`intentCanvas.manager.${actionPrompt.action}`)}
            isDeleting={isConfirming}
            onCancel={onCancelAction}
            onConfirm={onConfirmAction}
          />
        </div>
      ) : null}
    </article>
  );
}
