import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Search from "lucide-react/dist/esm/icons/search";
import type { ConversationItem } from "../../../../types";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import { DiffBlock } from "../../../git/components/DiffBlock";
import { languageFromPath } from "../../../../utils/syntax";
import { ImageLightbox } from "../../components/media/MessageMediaBlocks";
import { LocalImage } from "../../components/media/LocalImage";
import { Markdown } from "../../components/Markdown";

type ReviewRowProps = {
  item: Extract<ConversationItem, { kind: "review" }>;
  workspaceId?: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  onOpenHtmlInBrowser?: (path: string) => void;
};

type DiffRowProps = {
  item: Extract<ConversationItem, { kind: "diff" }>;
};

type ExploreRowProps = {
  item: Extract<ConversationItem, { kind: "explore" }>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

type GeneratedImageRowProps = {
  item: Extract<ConversationItem, { kind: "generatedImage" }>;
  workspaceId?: string | null;
};

function areGeneratedImageItemsEqual(
  previous: Extract<ConversationItem, { kind: "generatedImage" }>,
  next: Extract<ConversationItem, { kind: "generatedImage" }>,
) {
  if (previous === next) {
    return true;
  }
  if (
    previous.id !== next.id ||
    previous.status !== next.status ||
    previous.promptText !== next.promptText ||
    previous.fallbackText !== next.fallbackText ||
    previous.anchorUserMessageId !== next.anchorUserMessageId ||
    previous.images.length !== next.images.length
  ) {
    return false;
  }
  return previous.images.every((image, index) => {
    const nextImage = next.images[index];
    return nextImage?.src === image.src && nextImage.localPath === image.localPath;
  });
}

export const GeneratedImageRow = memo(function GeneratedImageRow({
  item,
  workspaceId = null,
}: GeneratedImageRowProps) {
  const { t } = useTranslation();
  const generatedImageTitle = t("messages.generatedImageTitle");
  const generatedImageProcessingLabel = t("messages.generatedImageProcessing");
  const generatedImageCompletedLabel = t("messages.generatedImageCompleted");
  const generatedImageDegradedLabel = t("messages.generatedImageDegraded");
  const generatedImageProcessingHint = t("messages.generatedImageProcessingHint");
  const generatedImageDegradedHint = t("messages.generatedImageDegradedHint");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageItems = useMemo(
    () =>
      item.images.map((image, index) => ({
        src: image.src,
        label: t("messages.generatedImagePreviewLabel", { index: index + 1 }),
        localPath: image.localPath ?? null,
      })),
    [item.images, t],
  );
  const statusLabel =
    item.status === "processing"
      ? generatedImageProcessingLabel
      : item.status === "completed"
        ? generatedImageCompletedLabel
        : generatedImageDegradedLabel;
  const statusClassName =
    item.status === "processing"
      ? "is-processing"
      : item.status === "completed"
        ? "is-completed"
        : "is-degraded";

  return (
    <div
      className="message-generated-image-card"
      data-generated-image-anchor={item.anchorUserMessageId ?? undefined}
    >
      <div className="message-generated-image-header">
        <div className="message-generated-image-title-group">
          <span className="message-generated-image-eyebrow">{generatedImageTitle}</span>
          {item.promptText ? (
            <div className="message-generated-image-prompt">{item.promptText}</div>
          ) : null}
        </div>
        <span className={`message-generated-image-status ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      {item.status === "processing" ? (
        <div className="message-generated-image-hint">{generatedImageProcessingHint}</div>
      ) : null}
      {imageItems.length > 0 ? (
        <div className="message-generated-image-grid" role="list">
          {imageItems.map((image, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              className="message-generated-image-thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={image.label}
            >
              <LocalImage
                src={image.src}
                localPath={image.localPath}
                workspaceId={workspaceId}
                alt={image.label}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
      {item.status === "degraded" ? (
        <div className="message-generated-image-hint">
          {item.fallbackText || generatedImageDegradedHint}
        </div>
      ) : null}
      {lightboxIndex !== null && imageItems.length > 0 ? (
        <ImageLightbox
          images={imageItems.map(({ src, label, localPath }) => ({
            src,
            label,
            localPath,
          }))}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}, (previous, next) => (
  previous.workspaceId === next.workspaceId &&
  areGeneratedImageItemsEqual(previous.item, next.item)
));

export const ReviewRow = memo(function ReviewRow({
  item,
  workspaceId = null,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenHtmlInBrowser,
}: ReviewRowProps) {
  const title = item.state === "started" ? "Review started" : "Review completed";
  return (
    <div className="item-card review">
      <div className="review-header">
        <span className="review-title">{title}</span>
        <span className={`review-badge ${item.state === "started" ? "active" : "done"}`}>
          Review
        </span>
      </div>
      {item.text && (
        <Markdown
          value={item.text}
          className="item-text markdown"
          workspaceId={workspaceId}
          onOpenFileLink={onOpenFileLink}
          onOpenFileLinkMenu={onOpenFileLinkMenu}
          onOpenHtmlInBrowser={onOpenHtmlInBrowser}
        />
      )}
    </div>
  );
});

export const DiffRow = memo(function DiffRow({ item }: DiffRowProps) {
  return (
    <div className="item-card diff">
      <div className="diff-header">
        <span className="diff-title">{item.title}</span>
        {item.status && <span className="item-status">{item.status}</span>}
      </div>
      <div className="diff-viewer-output">
        <DiffBlock diff={item.diff} language={languageFromPath(item.title)} />
      </div>
    </div>
  );
});

function exploreKindLabel(kind: ExploreRowProps["item"]["entries"][number]["kind"]) {
  return (kind[0] ?? "").toUpperCase() + kind.slice(1);
}

function buildInlineExploreTitle(
  title: string,
  entry: ExploreRowProps["item"]["entries"][number] | undefined,
) {
  if (!entry) {
    return title;
  }
  const detail = entry.detail && entry.detail !== entry.label ? entry.detail : "";
  return [title, "·", exploreKindLabel(entry.kind), entry.label, detail]
    .filter(Boolean)
    .join(" ");
}

export const ExploreRow = memo(function ExploreRow({
  item,
  isExpanded,
  onToggle,
}: ExploreRowProps) {
  const { t } = useTranslation();
  const title = item.title ?? (item.status === "exploring" ? "Exploring" : "Explored");
  const isCollapsible =
    item.collapsible ?? (item.status === "explored" && item.entries.length > 0);
  const listCollapsed = isCollapsible && !isExpanded;
  const inlineSummary = listCollapsed;
  const rowClassName = `tool-inline explore-inline${isCollapsible ? " is-collapsible" : ""}${
    listCollapsed ? " is-collapsed" : ""
  }${inlineSummary ? " is-inline-summary" : ""}`;
  const displayTitle = inlineSummary
    ? buildInlineExploreTitle(title, item.entries[0])
    : title;
  const handleToggle = () => {
    if (isCollapsible) {
      onToggle(item.id);
    }
  };

  return (
    <div className={rowClassName}>
      <div className="tool-inline-content">
        <div className="explore-inline-header">
          {isCollapsible ? (
            <button
              type="button"
              className="explore-inline-header-toggle"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={`${displayTitle} · ${t("messages.toggleDetails")}`}
            >
              <Search className="explore-inline-icon" size={14} aria-hidden />
              <span className="explore-inline-title" title={displayTitle}>{displayTitle}</span>
            </button>
          ) : (
            <>
              <Search className="explore-inline-icon" size={14} aria-hidden />
              <span className="explore-inline-title" title={displayTitle}>{displayTitle}</span>
            </>
          )}
        </div>
        <CollapsibleReveal open={!listCollapsed}>
          <div className="explore-inline-list">
            {item.entries.map((entry, index) => (
              <div key={`${entry.kind}-${entry.label}-${index}`} className="explore-inline-item">
                <span className="explore-inline-kind">{exploreKindLabel(entry.kind)}</span>
                <span className="explore-inline-label">{entry.label}</span>
                {entry.detail && entry.detail !== entry.label && (
                  <span className="explore-inline-detail">{entry.detail}</span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleReveal>
      </div>
    </div>
  );
});
