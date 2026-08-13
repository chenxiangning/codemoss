import {
  projectMemoryCaptureAuto,
  projectMemoryCaptureTurnInput,
  projectMemoryCompleteTurn,
  projectMemoryCreate,
  projectMemoryDelete,
  projectMemoryDiagnostics,
  projectMemoryGet,
  projectMemoryGetDetail,
  projectMemoryGetSettings,
  projectMemoryList,
  projectMemoryListSummary,
  projectMemoryReconcile,
  projectMemoryUpdate,
  projectMemoryUpdateSettings,
  type ProjectMemoryItem,
  type ProjectMemoryListResult,
  type ProjectMemoryDiagnosticsResult,
  type ProjectMemoryReconcileResult,
  type ProjectMemorySettings,
  type NormalizedConversationTurnPayload,
} from "../../../services/tauri";

export type ListProjectMemoryParams = {
  workspaceId: string;
  query?: string | null;
  kind?: string | null;
  importance?: string | null;
  tag?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export type CreateProjectMemoryParams = {
  workspaceId: string;
  schemaVersion?: number | null;
  recordKind?: ProjectMemoryItem["recordKind"];
  kind?: string | null;
  title?: string | null;
  summary?: string | null;
  detail?: string | null;
  tags?: string[] | null;
  importance?: string | null;
  threadId?: string | null;
  turnId?: string | null;
  messageId?: string | null;
  assistantMessageId?: string | null;
  userInput?: string | null;
  assistantResponse?: string | null;
  assistantThinkingSummary?: string | null;
  reviewState?: ProjectMemoryItem["reviewState"];
  source?: string | null;
  workspaceName?: string | null;
  workspacePath?: string | null;
  engine?: string | null;
};

export type UpdateProjectMemoryParams = {
  schemaVersion?: number | null;
  recordKind?: ProjectMemoryItem["recordKind"];
  kind?: string | null;
  title?: string | null;
  summary?: string | null;
  detail?: string | null;
  tags?: string[] | null;
  importance?: string | null;
  threadId?: string | null;
  turnId?: string | null;
  messageId?: string | null;
  assistantMessageId?: string | null;
  userInput?: string | null;
  assistantResponse?: string | null;
  assistantThinkingSummary?: string | null;
  reviewState?: ProjectMemoryItem["reviewState"];
  source?: string | null;
  workspaceName?: string | null;
  workspacePath?: string | null;
  engine?: string | null;
};

export type CaptureTurnInputParams = NormalizedConversationTurnPayload & {
  userInput: string;
};

export type CompleteTurnMemoryParams = NormalizedConversationTurnPayload & {
  assistantResponse: string;
  memoryId?: string | null;
  kind?: string | null;
  title?: string | null;
  summary?: string | null;
  importance?: string | null;
};

function scheduleEmbedIndexUpsert(
  workspaceId: string,
  memory: ProjectMemoryItem | null | undefined,
) {
  if (!memory?.id || !workspaceId) return;
  // 旁路异步：动态 import 避免 facade ↔ worker 环；失败不传播
  void import("../utils/projectMemoryEmbeddingIndexWorker")
    .then(({ enqueueEmbedIndexUpsert }) => {
      enqueueEmbedIndexUpsert(workspaceId, memory);
    })
    .catch(() => {
      // ignore
    });
}

function scheduleEmbedIndexDelete(workspaceId: string, memoryId: string) {
  if (!memoryId || !workspaceId) return;
  void import("../utils/projectMemoryEmbeddingIndexWorker")
    .then(({ enqueueEmbedIndexDelete }) => {
      enqueueEmbedIndexDelete(workspaceId, memoryId);
    })
    .catch(() => {
      // ignore
    });
}

export const projectMemoryFacade = {
  getSettings(): Promise<ProjectMemorySettings> {
    return projectMemoryGetSettings();
  },
  updateSettings(settings: ProjectMemorySettings): Promise<ProjectMemorySettings> {
    return projectMemoryUpdateSettings(settings);
  },
  list(params: ListProjectMemoryParams): Promise<ProjectMemoryListResult> {
    return projectMemoryList(params);
  },
  listSummary(params: ListProjectMemoryParams): Promise<ProjectMemoryListResult> {
    return projectMemoryListSummary(params);
  },
  get(memoryId: string, workspaceId: string): Promise<ProjectMemoryItem | null> {
    return projectMemoryGet(memoryId, workspaceId);
  },
  getDetail(memoryId: string, workspaceId: string): Promise<ProjectMemoryItem | null> {
    return projectMemoryGetDetail(memoryId, workspaceId);
  },
  async create(params: CreateProjectMemoryParams): Promise<ProjectMemoryItem> {
    const created = await projectMemoryCreate(params);
    scheduleEmbedIndexUpsert(created.workspaceId, created);
    return created;
  },
  async update(
    memoryId: string,
    workspaceId: string,
    patch: UpdateProjectMemoryParams,
  ): Promise<ProjectMemoryItem> {
    const updated = await projectMemoryUpdate(memoryId, workspaceId, patch);
    scheduleEmbedIndexUpsert(updated.workspaceId || workspaceId, updated);
    return updated;
  },
  async delete(memoryId: string, workspaceId: string): Promise<void> {
    await projectMemoryDelete(memoryId, workspaceId);
    scheduleEmbedIndexDelete(workspaceId, memoryId);
  },
  diagnostics(workspaceId: string): Promise<ProjectMemoryDiagnosticsResult> {
    return projectMemoryDiagnostics(workspaceId);
  },
  reconcile(workspaceId: string, dryRun: boolean): Promise<ProjectMemoryReconcileResult> {
    return projectMemoryReconcile(workspaceId, dryRun);
  },
  captureAuto(input: {
    workspaceId: string;
    text: string;
    threadId?: string | null;
    turnId?: string | null;
    messageId?: string | null;
    source?: string | null;
    workspaceName?: string | null;
    workspacePath?: string | null;
    engine?: string | null;
  }): Promise<ProjectMemoryItem | null> {
    // capture 输入确权可不 embed；等 complete 再索引
    return projectMemoryCaptureAuto(input);
  },
  captureTurnInput(input: CaptureTurnInputParams): Promise<ProjectMemoryItem | null> {
    return projectMemoryCaptureTurnInput(input);
  },
  async completeTurnMemory(
    input: CompleteTurnMemoryParams,
  ): Promise<ProjectMemoryItem> {
    const completed = await projectMemoryCompleteTurn(input);
    scheduleEmbedIndexUpsert(completed.workspaceId || input.workspaceId, completed);
    return completed;
  },
};
