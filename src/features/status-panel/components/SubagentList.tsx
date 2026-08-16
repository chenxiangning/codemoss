import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SubagentInfo } from "../types";
import {
  buildSubagentCardFromSubagentInfo,
  enrichSubagentCardStatuses,
  enrichSubagentCardsFromTaskNotifications,
  mergeConversationItemSources,
  mergeSubagentEnrichmentSources,
  openSubagentInspector,
  syncSubagentInspectorFromCards,
  useSubagentSessionProbeVersion,
} from "@mossx/plugin-subagent-ui/runtime";
import { SubagentPersonaCard } from "@mossx/plugin-subagent-ui/ui";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";

interface SubagentListProps {
  subagents: SubagentInfo[];
  /** 打开幕布 inspector 后的副作用（如关闭 popover） */
  onInspectSubagent?: (agent: SubagentInfo) => void;
}

/**
 * 右下角子代理：单行列表（无定位 icon、无选中底）。
 * 点击 → 打开幕布内 SubAgent inspector 抽屉。
 */
export const SubagentList = memo(function SubagentList({
  subagents,
  onInspectSubagent,
}: SubagentListProps) {
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

  const cards = useMemo(() => {
    const raw = subagents.map((agent, index) =>
      buildSubagentCardFromSubagentInfo(agent, {
        index,
        parentThreadId,
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
        ? threadItemsByThread[parentThreadId] ?? null
        : null;
    const notificationSource = mergeConversationItemSources(
      canvasItems,
      parentTableItems,
    );
    // 与幕布 S10 同源：task-notification 终态/result 迁入，避免 StatusPanel 卡死 running
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
    syncSubagentInspectorFromCards(cards.map((entry) => entry.card));
  }, [cards]);

  if (subagents.length === 0) {
    return <div className="sp-empty">{t("statusPanel.emptySubagents")}</div>;
  }

  return (
    <div className="sp-subagent-list-rows" aria-label={t("statusPanel.tabSubagents")}>
      {cards.map(({ agent, card }) => (
        <div key={agent.id} className="sp-subagent-list-row">
          <SubagentPersonaCard
            card={card}
            layout="row"
            selected={false}
            onSelect={(next) => {
              openSubagentInspector(next);
              onInspectSubagent?.(agent);
            }}
          />
        </div>
      ))}
    </div>
  );
});
