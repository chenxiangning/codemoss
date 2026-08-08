import { memo, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";
import {
  closeSubagentInspector,
  closeSubagentInspectorIfScopeChanged,
  useSubagentInspectorSelection,
} from "../hooks/useSubagentInspectorStore";
import { ConversationInspectorSplit } from "./ConversationInspectorSplit";
import { SubagentInspectorDrawer } from "./SubagentInspectorDrawer";

type SubagentChatSplitProps = {
  messagesNode: ReactNode;
  composerNode: ReactNode | null;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/** Compatibility wrapper for existing SubAgent-only consumers. */
export const SubagentChatSplit = memo(function SubagentChatSplit({
  messagesNode,
  composerNode,
  workspaceId = null,
  workspacePath = null,
}: SubagentChatSplitProps) {
  const { t } = useTranslation();
  const selection = useSubagentInspectorSelection();
  const parentThreadId = useActiveCanvasSelector((state) => state.threadId);
  const parentWorkspaceId = useActiveCanvasSelector((state) => state.workspaceId);
  useEffect(() => {
    closeSubagentInspectorIfScopeChanged(
      workspaceId ?? parentWorkspaceId,
      parentThreadId,
    );
  }, [parentThreadId, parentWorkspaceId, workspaceId]);
  return (
    <ConversationInspectorSplit
      messagesNode={messagesNode}
      composerNode={composerNode}
      open={Boolean(selection)}
      inspectorNode={
        selection ? (
          <SubagentInspectorDrawer
            workspaceId={workspaceId}
            workspacePath={workspacePath}
          />
        ) : null
      }
      resizeLabel={t("subagentUi.resizeSplit", {
        defaultValue: "调整子代理面板宽度",
      })}
      onRequestClose={closeSubagentInspector}
    />
  );
});
