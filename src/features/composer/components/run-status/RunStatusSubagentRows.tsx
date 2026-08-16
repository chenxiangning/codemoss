/**
 * Composer 运行态条 · 子代理极简单行列表（方案 A）
 * 不复用 SubagentPersonaCard 的进度条/重绿样式；仅 strip 展开区使用。
 */
import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import type { SubagentInfo } from "@mossx/plugin-status/runtime";
import {
  buildSubagentCardFromSubagentInfo,
  enrichSubagentCardStatuses,
  enrichSubagentCardsFromTaskNotifications,
  mergeConversationItemSources,
  openSubagentInspector,
  type SubagentCardViewModel,
} from "@mossx/plugin-subagent-ui/runtime";
import {
  mergeSubagentEnrichmentSources,
  useSubagentSessionProbeVersion,
} from "@mossx/plugin-subagent-ui/runtime";
import { syncSubagentInspectorFromCards } from "@mossx/plugin-subagent-ui/runtime";
import { useActiveCanvasSelector } from "../../../layout/hooks/activeCanvasStore";

type RunStatusSubagentRowsProps = {
  subagents: SubagentInfo[];
  onInspectSubagent?: (agent: SubagentInfo) => void;
};

export const RunStatusSubagentRows = memo(function RunStatusSubagentRows({
  subagents,
  onInspectSubagent,
}: RunStatusSubagentRowsProps) {
  const { t } = useTranslation();
  const probeVersion = useSubagentSessionProbeVersion();
  const parentThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
  const nativeThreadIds = useActiveCanvasSelector(
    (snapshot) => snapshot.activeNativeThreadIds,
  );
  const threadStatusById = useActiveCanvasSelector(
    (snapshot) => snapshot.threadStatusById,
  );
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );
  const canvasItems = useActiveCanvasSelector((snapshot) => snapshot.items);

  const rows = useMemo(() => {
    const raw = subagents.map((agent, index) =>
      buildSubagentCardFromSubagentInfo(agent, {
        index,
        parentThreadId,
        // Shared Claude：拼 claude:subagent:{owner}:{agentId} 必需
        nativeThreadIds,
      }),
    );
    const enrichment = mergeSubagentEnrichmentSources({
      statusById: threadStatusById,
      itemsByThread: threadItemsByThread,
    });
    const statusEnriched = enrichSubagentCardStatuses(raw, enrichment);
    const parentTableItems =
      parentThreadId && threadItemsByThread
        ? (threadItemsByThread[parentThreadId] ?? null)
        : null;
    const notificationSource = mergeConversationItemSources(
      canvasItems,
      parentTableItems,
    );
    const enriched = enrichSubagentCardsFromTaskNotifications(
      statusEnriched,
      notificationSource,
    );
    return subagents.map((agent, index) => ({
      agent,
      card: enriched[index] ?? raw[index]!,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probeVersion 订阅旁路 load
  }, [
    canvasItems,
    nativeThreadIds,
    parentThreadId,
    probeVersion,
    subagents,
    threadItemsByThread,
    threadStatusById,
  ]);

  useEffect(() => {
    syncSubagentInspectorFromCards(rows.map((entry) => entry.card));
  }, [rows]);

  if (subagents.length === 0) {
    return (
      <div className="sp-empty">{t("statusPanel.emptySubagents")}</div>
    );
  }

  return (
    <ul
      className="crs-subagent-rows"
      aria-label={t("statusPanel.tabSubagents")}
    >
      {rows.map(({ agent, card }) => (
        <li key={agent.id}>
          <SubagentStripRow
            card={card}
            onSelect={() => {
              openSubagentInspector(card);
              onInspectSubagent?.(agent);
            }}
          />
        </li>
      ))}
    </ul>
  );
});

const SubagentStripRow = memo(function SubagentStripRow({
  card,
  onSelect,
}: {
  card: SubagentCardViewModel;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const status = card.status;
  const statusLabel =
    status === "completed"
      ? t("subagentUi.status.completed")
      : status === "error"
        ? t("subagentUi.status.error")
        : t("subagentUi.status.running");

  const title =
    card.description?.trim() ||
    card.typeLabel?.trim() ||
    t("subagentUi.defaultName");

  return (
    <button
      type="button"
      className={`crs-subagent-row is-${status}`}
      onClick={onSelect}
      title={title}
    >
      <span className="crs-subagent-dot" aria-hidden />
      <span className="crs-subagent-title">{title}</span>
      <span className="crs-subagent-status">{statusLabel}</span>
      <ChevronRight
        size={14}
        strokeWidth={2}
        className="crs-subagent-chevron"
        aria-hidden
      />
    </button>
  );
});
