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
import {
  closeSquadInspector,
  closeSquadInspectorIfScopeChanged,
  useSquadInspectorSelection,
} from "../store/squadStore";
import { SquadConversationSurface } from "./SquadConversationSurface";
import { SquadInspectorDrawer } from "./SquadInspectorDrawer";

type SquadConversationInspectorHostProps = {
  messagesNode: ReactNode;
  composerNode: ReactNode | null;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

export function SquadConversationInspectorHost({
  messagesNode,
  composerNode,
  workspaceId = null,
  workspacePath = null,
}: SquadConversationInspectorHostProps) {
  const { t } = useTranslation();
  const parentScope = useActiveCanvasSelector(
    (state) => ({
      threadId: state.threadId,
      workspaceId: state.workspaceId,
    }),
    shallowEqual,
  );
  // Canvas owns the atomic Conversation scope. Layout props can advance one
  // render earlier during cross-workspace navigation and are fallback only.
  const squadWorkspaceId = parentScope.workspaceId ?? workspaceId;
  // Preserve the existing SubAgent scope precedence; this regression fix must
  // not change legacy SubAgent navigation behavior.
  const subagentWorkspaceId = workspaceId ?? parentScope.workspaceId;
  const squadSelection = useSquadInspectorSelection();
  const subagentSelection = useSubagentInspectorSelection();

  useEffect(() => {
    closeSquadInspectorIfScopeChanged(
      squadWorkspaceId,
      parentScope.threadId,
    );
    closeSubagentInspectorIfScopeChanged(
      subagentWorkspaceId,
      parentScope.threadId,
    );
  }, [parentScope.threadId, squadWorkspaceId, subagentWorkspaceId]);

  const squadOpen = Boolean(squadSelection);
  const subagentOpen = !squadOpen && Boolean(subagentSelection);
  return (
    <ConversationInspectorSplit
      messagesNode={messagesNode}
      conversationSurface={
        <SquadConversationSurface
          workspaceId={squadWorkspaceId}
          threadId={parentScope.threadId}
        />
      }
      composerNode={composerNode}
      open={squadOpen || subagentOpen}
      inspectorNode={
        squadOpen ? (
          <SquadInspectorDrawer />
        ) : subagentOpen ? (
          <SubagentInspectorDrawer
            workspaceId={subagentWorkspaceId}
            workspacePath={workspacePath}
          />
        ) : null
      }
      resizeLabel={
        squadOpen
          ? t("squadOrchestration.inspector.resize")
          : t("subagentUi.resizeSplit", { defaultValue: "调整子代理面板宽度" })
      }
      onRequestClose={squadOpen ? closeSquadInspector : closeSubagentInspector}
    />
  );
}
