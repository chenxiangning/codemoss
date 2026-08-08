import { useTranslation } from "react-i18next";

import { useCollabUiState } from "../store/collabUiStore";

/**
 * 主幕时间线尾部 loading 行：
 * - starting_stages：首节点尚未挂 sticky 编排卡时的空窗
 * - summarizing：只由 sticky OrchCard / CollabPhaseCard 承担，时间线不再重复刷「正在生成交付汇总」
 */
export function CollabTimelineWaiting({
  workspaceId,
  threadId,
}: {
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
}) {
  const { t } = useTranslation();
  const collabUi = useCollabUiState(workspaceId, threadId);
  // summarizing 只保留对话框上方 sticky，去掉主幕时间线红框 loading
  if (!collabUi || collabUi.phase !== "starting_stages") {
    return null;
  }
  const label = collabUi.headline || t("multiAgent.collab.starting");
  return (
    <div className="ma-collab-waiting" role="status" aria-live="polite">
      <div className="ma-prog is-indeterminate" aria-hidden>
        <i />
      </div>
      <div className="ma-collab-waiting-body">
        <span className="ma-orch-pending-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="ma-collab-waiting-text">{label}</span>
      </div>
    </div>
  );
}
