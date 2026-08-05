import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  shallowEqual,
  useActiveCanvasSelector,
} from "../../layout/hooks/activeCanvasStore";
import {
  closeSubagentInspector,
  closeSubagentInspectorIfScopeChanged,
  ConversationInspectorSplit,
  SubagentInspectorDrawer,
  useSubagentInspectorSelection,
} from "../../subagent-ui";
import { isTerminalAgentStatus } from "../types";
import {
  closeAgentInspector,
  closeAgentInspectorIfScopeChanged,
  openAgentInspector,
  useAgentInspectorSelection,
} from "../store/inspectorStore";
import { useAgentProjection } from "../store/agentStore";
import { AgentInspectorDrawer } from "./AgentInspectorDrawer";
import { MultiAgentConversationSurface } from "./ConversationSurface";

type MultiAgentConversationHostProps = {
  messagesNode: ReactNode;
  composerNode: ReactNode | null;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/**
 * 聊天列宿主：
 * - Multi-Agent 活跃时优先左右分屏展示协作 Inspector（直播），不被原生子代理抢走。
 * - 无 Multi-Agent 时保留 engine-native SubAgent inspector。
 */
export function MultiAgentConversationHost({
  messagesNode,
  composerNode,
  workspaceId = null,
  workspacePath = null,
}: MultiAgentConversationHostProps) {
  const { t } = useTranslation();
  const parentScope = useActiveCanvasSelector(
    (state) => ({
      threadId: state.threadId,
      workspaceId: state.workspaceId,
    }),
    shallowEqual,
  );
  const agentWorkspaceId = parentScope.workspaceId ?? workspaceId;
  const subagentWorkspaceId = workspaceId ?? parentScope.workspaceId;
  const projection = useAgentProjection(
    agentWorkspaceId,
    parentScope.threadId,
  );
  const agentSelection = useAgentInspectorSelection();
  const subagentSelection = useSubagentInspectorSelection();

  useEffect(() => {
    closeAgentInspectorIfScopeChanged(
      agentWorkspaceId,
      parentScope.threadId,
    );
    closeSubagentInspectorIfScopeChanged(
      subagentWorkspaceId,
      parentScope.threadId,
    );
  }, [agentWorkspaceId, parentScope.threadId, subagentWorkspaceId]);

  // 协作 run 进行中自动打开右侧直播面板。
  useEffect(() => {
    if (
      !projection ||
      !agentWorkspaceId ||
      !parentScope.threadId ||
      isTerminalAgentStatus(projection.status)
    ) {
      return;
    }
    openAgentInspector({
      workspaceId: agentWorkspaceId,
      threadId: parentScope.threadId,
      runId: projection.runId,
    });
  }, [
    agentWorkspaceId,
    parentScope.threadId,
    projection?.runId,
    projection?.status,
  ]);

  const agentActive =
    Boolean(projection) &&
    !isTerminalAgentStatus(projection!.status);
  const agentOpen =
    Boolean(agentSelection) &&
    Boolean(projection) &&
    agentSelection!.runId === projection!.runId;
  // Multi-Agent 活跃时压制原生子代理分屏，避免「规划中变成子代理网格」。
  const subagentOpen = !agentActive && Boolean(subagentSelection);
  const open = agentOpen || subagentOpen;

  return (
    <ConversationInspectorSplit
      messagesNode={messagesNode}
      conversationSurface={
        <MultiAgentConversationSurface
          workspaceId={agentWorkspaceId}
          threadId={parentScope.threadId}
        />
      }
      composerNode={composerNode}
      open={open}
      inspectorNode={
        agentOpen ? (
          <AgentInspectorDrawer />
        ) : subagentOpen ? (
          <SubagentInspectorDrawer
            workspaceId={subagentWorkspaceId}
            workspacePath={workspacePath}
          />
        ) : null
      }
      resizeLabel={
        agentOpen
          ? t("multiAgent.inspector.resize")
          : t("subagentUi.resizeSplit", {
              defaultValue: "调整子代理面板宽度",
            })
      }
      onRequestClose={
        agentOpen ? closeAgentInspector : closeSubagentInspector
      }
    />
  );
}
