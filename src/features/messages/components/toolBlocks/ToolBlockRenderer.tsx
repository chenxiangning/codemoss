/**
 * 工具块分发器 - 根据工具类型选择合适的组件展示
 * Tool Block Renderer - selects appropriate component based on tool type
 */
import { memo } from 'react';
import type { ConversationItem } from '../../../../types';
import {
  extractToolName,
  isMcpTool,
  isReadTool,
  isEditTool,
  isBashTool,
  isSearchTool,
} from './toolConstants';
import { GenericToolBlock } from './GenericToolBlock';
import { ReadToolBlock } from './ReadToolBlock';
import { EditToolBlock } from './EditToolBlock';
import { BashToolBlock } from './BashToolBlock';
import { SearchToolBlock } from './SearchToolBlock';
import { McpToolBlock } from './McpToolBlock';
import { RequestUserInputSubmittedBlock } from './RequestUserInputSubmittedBlock';

interface ToolBlockRendererProps {
  item: Extract<ConversationItem, { kind: 'tool' }>;
  workspaceId?: string | null;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onRequestAutoScroll?: () => void;
  activeCollaborationModeId?: string | null;
  activeEngine?: "claude" | "codex" | "gemini" | "grok" | "kimi" | "opencode";
  hasPendingUserInputRequest?: boolean;
  onOpenFilePath?: (path: string) => void;
  onOpenDiffPath?: (path: string) => void;
  selectedExitPlanExecutionMode?: 'default' | 'full-access' | null;
  onExitPlanModeExecute?: (
    itemId: string,
    mode: 'default' | 'full-access',
  ) => Promise<void> | void;
}

/**
 * 工具块分发器组件
 * 根据工具类型分发到对应的专用组件
 */
export const ToolBlockRenderer = memo(function ToolBlockRenderer({
  item,
  workspaceId = null,
  isExpanded,
  onToggle,
  onRequestAutoScroll,
  activeCollaborationModeId,
  activeEngine,
  hasPendingUserInputRequest = false,
  onOpenFilePath,
  onOpenDiffPath,
  selectedExitPlanExecutionMode = null,
  onExitPlanModeExecute,
}: ToolBlockRendererProps) {
  const toolName = extractToolName(item.title);
  const lower = toolName.toLowerCase();
  const normalizedToolName = toolName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedTitle = item.title.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const isExitPlanModeTool =
    normalizedToolName === "exitplanmode" ||
    normalizedToolName.endsWith("exitplanmode") ||
    normalizedTitle.includes("exitplanmode");

  // 0. 已提交的 request user input 历史卡片
  if (item.toolType === 'requestUserInputSubmitted') {
    return <RequestUserInputSubmittedBlock item={item} />;
  }

  // ExitPlanMode handoff must keep its dedicated card even if the runtime
  // classifies it as a command-like tool item.
  if (isExitPlanModeTool) {
    return (
      <GenericToolBlock
        item={item}
        workspaceId={workspaceId}
        isExpanded={isExpanded}
        onToggle={onToggle}
        activeCollaborationModeId={activeCollaborationModeId}
        activeEngine={activeEngine}
        hasPendingUserInputRequest={hasPendingUserInputRequest}
        onOpenFilePath={onOpenFilePath}
        onOpenDiffPath={onOpenDiffPath}
        selectedExitPlanExecutionMode={selectedExitPlanExecutionMode}
        onExitPlanModeExecute={onExitPlanModeExecute}
      />
    );
  }

  // 1. 命令执行工具
  if (item.toolType === 'commandExecution' || isBashTool(lower)) {
    return (
      <BashToolBlock
        item={item}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onRequestAutoScroll={onRequestAutoScroll}
      />
    );
  }

  // 2. 读取文件工具（Grok/Kimi/OpenCode Read / read_file / list_dir…）
  // 图片读取在 ReadToolBlock 内展开为真实预览（ImageViewToolContent），
  // 不再只显示 “Read image file: /path” 文案。
  if (isReadTool(lower)) {
    return (
      <ReadToolBlock
        item={item}
        workspaceId={workspaceId}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    );
  }

  // 3. Codex / structured multi-file fileChange (changes[])
  // MUST keep GenericToolBlock → FileChangeToolContent path: +N/-N stats, unified
  // diff expand, and onOpenDiffPath for open-file when diff is missing.
  // Do NOT route these through EditToolBlock (single-file arg polish only).
  if (item.toolType === 'fileChange') {
    return (
      <GenericToolBlock
        item={item}
        workspaceId={workspaceId}
        isExpanded={isExpanded}
        onToggle={onToggle}
        activeCollaborationModeId={activeCollaborationModeId}
        activeEngine={activeEngine}
        hasPendingUserInputRequest={hasPendingUserInputRequest}
        onOpenFilePath={onOpenFilePath}
        onOpenDiffPath={onOpenDiffPath}
        selectedExitPlanExecutionMode={selectedExitPlanExecutionMode}
        onExitPlanModeExecute={onExitPlanModeExecute}
      />
    );
  }

  // 4. Claude/Grok/Kimi 单文件 write/edit（detail 里是 path/old/new JSON）
  if (isEditTool(lower)) {
    return (
      <EditToolBlock
        item={item}
        onOpenDiffPath={onOpenFilePath ?? onOpenDiffPath}
      />
    );
  }

  // 5. 搜索工具 (grep, glob, search)
  if (isSearchTool(lower)) {
    return (
      <SearchToolBlock
        item={item}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    );
  }

  // 6. MCP 工具（仅真正 mcp__ 前缀；agent 通用 tool 名走专用块或 generic）
  if (isMcpTool(item.title) || (item.toolType === 'mcpToolCall' && isMcpTool(item.title))) {
    return (
      <McpToolBlock
        item={item}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    );
  }

  // 7. 其他工具使用通用组件（Task / Web / 未知 agent 工具）
  return (
    <GenericToolBlock
      item={item}
      workspaceId={workspaceId}
      isExpanded={isExpanded}
      onToggle={onToggle}
      activeCollaborationModeId={activeCollaborationModeId}
      activeEngine={activeEngine}
      hasPendingUserInputRequest={hasPendingUserInputRequest}
      onOpenFilePath={onOpenFilePath}
      onOpenDiffPath={onOpenDiffPath}
      selectedExitPlanExecutionMode={selectedExitPlanExecutionMode}
      onExitPlanModeExecute={onExitPlanModeExecute}
    />
  );
});

export default ToolBlockRenderer;
