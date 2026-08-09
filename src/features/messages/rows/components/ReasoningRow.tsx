import { memo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Brain from "lucide-react/dist/esm/icons/brain";
import type { ConversationItem } from "../../../../types";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import { useRenderHotspot } from "../../../../services/perfBaseline/useRenderHotspot";
import type { PresentationProfile } from "../../../../conversation-presentation/presentationProfile";
import { parseReasoning } from "../../presentation/messagesReasoning";
import {
  resolveReasoningStreamingThrottleMs,
  type StreamMitigationProfile,
} from "../presentation/messagesStreamingComplexity";
import { Markdown } from "../../components/Markdown";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";

type ReasoningRowProps = {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  workspaceId?: string | null;
  parsed: ReturnType<typeof parseReasoning>;
  isExpanded: boolean;
  isLive: boolean;
  activeEngine?: MessagesEngine;
  onToggle: (id: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: MouseEvent, path: string) => void;
  presentationProfile?: PresentationProfile | null;
  streamMitigationProfile?: StreamMitigationProfile | null;
};

export const ReasoningRow = memo(function ReasoningRow({
  item,
  workspaceId = null,
  parsed,
  isExpanded,
  isLive,
  activeEngine,
  onToggle,
  onOpenFileLink,
  onOpenFileLinkMenu,
  presentationProfile = null,
  streamMitigationProfile = null,
}: ReasoningRowProps) {
  const { t } = useTranslation();
  const { bodyText } = parsed;
  // header 固定显示「思考过程 / 思考中」，不会渲染 summaryTitle。
  // 当 summary 与 content 同为多行正文时，parseReasoning 会把首行当 title 剥掉，
  // 导致合并后的相邻思考丢失第一段；此时直接用 raw content。
  const shouldPreferRawReasoningContent =
    item.summary.trim().length > 0 &&
    item.content.trim().length > 0 &&
    item.summary.trim() === item.content.trim() &&
    item.content.includes("\n");
  const thinkingText = shouldPreferRawReasoningContent
    ? item.content
    : bodyText || item.content || item.summary || "";
  // jetbrains 同帧 stick：live 思考正文不再 deferred，避免折叠/长高与钉底错拍。
  const renderThinkingText = thinkingText;
  const isEncryptedCodexReasoning =
    activeEngine === "codex" && thinkingText.trim() === "Encrypted reasoning";
  useRenderHotspot(
    "message-row-render",
    `reasoning:${thinkingText.length}ch:${isLive ? "stream" : "idle"}`,
    isLive && !isEncryptedCodexReasoning,
  );
  if (isEncryptedCodexReasoning) {
    return null;
  }
  const title = isLive ? t("messages.thinking") : t("messages.thinkingProcess");
  return (
    <div className={`thinking-block${isExpanded ? " is-expanded" : ""}${isLive ? " is-live" : ""}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => onToggle(item.id)}
      >
        <span className="thinking-header-copy">
          <Brain className="thinking-brain-icon" size={14} aria-hidden />
          <span className="thinking-title">{title}</span>
        </span>
      </button>
      {/*
        始终 keepMounted：对齐旧 display:none 语义（折叠仍保留 Markdown DOM，
        避免 live delta / 合并正文 / 测试与搜索锚点丢失），仅用动画开合。
      */}
      <CollapsibleReveal
        open={isExpanded}
        keepMounted
        className="thinking-content-reveal"
        innerClassName="thinking-content"
      >
        {thinkingText ? (
          <div className="reasoning-markdown-surface">
            {/*
              live 阶段走 lightweight markdown：reasoning delta 更新频繁；
              settle 后切回 full markdown 渲染最终内容。
            */}
            <Markdown
              value={renderThinkingText}
              className={`markdown reasoning-markdown${isLive ? " markdown-live-streaming" : ""}`}
              workspaceId={workspaceId}
              codeBlockStyle="message"
              streamingThrottleMs={resolveReasoningStreamingThrottleMs(
                isLive,
                streamMitigationProfile,
                presentationProfile,
              )}
              liveRenderMode={isLive ? "lightweight" : "full"}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
            />
          </div>
        ) : (
          <span>{t("messages.noThinkingContent")}</span>
        )}
      </CollapsibleReveal>
    </div>
  );
});
