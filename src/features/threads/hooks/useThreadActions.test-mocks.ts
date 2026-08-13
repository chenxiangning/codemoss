import { vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  connectWorkspace,
  deleteCodexSession,
  deleteClaudeSession,
  deleteGeminiSession,
  deleteGrokSession,
  deleteKimiSession,
  deleteOpenCodeSession,
  getOpenCodeSessionList,
  listClaudeSessions,
  listGeminiSessions,
  listGrokSessions,
  listKimiSessions,
  listPiSessions,
  invalidateSessionIndexForWorkspace,
  listSessionIndexForWorkspace,
  listThreadTitles,
  listWorkspaceSessionArchiveEvidence,
  listWorkspaceSessions,
  loadGeminiSession,
  loadGrokSession,
  loadKimiSession,
  loadPiSession,
  readWorkspaceFile,
  renameThreadTitleKey,
  setThreadTitle,
  trashWorkspaceItem,
  writeWorkspaceFile,
} from "../../../services/tauri";
import { mergeThreadItems, previewThreadName } from "../../../utils/threadItems";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";
import { resetSharedNativeVisibilityMemory } from "./sharedNativeVisibility";

vi.mock("../../../services/tauri", () => ({
  startThread: vi.fn(),
  connectWorkspace: vi.fn(),
  createWorkspaceDirectory: vi.fn(),
  forkClaudeSession: vi.fn(),
  forkClaudeSessionFromMessage: vi.fn(),
  forkThread: vi.fn(),
  rewindCodexThread: vi.fn(),
  listClaudeSessions: vi.fn(),
  listGeminiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  listKimiSessions: vi.fn(),
  listPiSessions: vi.fn(),
  invalidateSessionIndexForWorkspace: vi.fn(),
  listSessionIndexForWorkspace: vi.fn(),
  getOpenCodeSessionList: vi.fn(),
  listWorkspaceSessions: vi.fn(),
  listWorkspaceSessionArchiveEvidence: vi.fn(),
  loadClaudeSession: vi.fn(),
  loadGeminiSession: vi.fn(),
  loadGrokSession: vi.fn(),
  loadKimiSession: vi.fn(),
  loadPiSession: vi.fn(),
  loadCodexSession: vi.fn(),
  listThreadTitles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  setThreadTitle: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSession: vi.fn(),
  deleteClaudeSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  deleteGrokSession: vi.fn(),
  deleteKimiSession: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  trashWorkspaceItem: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  extractClaudeApprovalResumeEntries: vi.fn(() => []),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  normalizeItem: vi.fn((item: ConversationItem) => item),
  previewThreadName: vi.fn(),
  stripClaudeApprovalResumeArtifacts: vi.fn((text: string) => text),
}));

vi.mock("../utils/threadStorage", () => ({
  makeCustomNameKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
  saveThreadActivity: vi.fn(),
}));

vi.mock("../utils/sidebarSnapshot", () => ({
  loadSidebarSnapshot: vi.fn(() => null),
}));

vi.mock("../../../services/globalRuntimeNotices", async () => {
  const actual = await vi.importActual<typeof import("../../../services/globalRuntimeNotices")>(
    "../../../services/globalRuntimeNotices",
  );
  return actual;
});

export function resetUseThreadActionsTestMocks() {
  resetSharedNativeVisibilityMemory();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.mocked(listThreadTitles).mockResolvedValue({});
  vi.mocked(listClaudeSessions).mockResolvedValue([]);
  vi.mocked(listGeminiSessions).mockResolvedValue([]);
  vi.mocked(listGrokSessions).mockResolvedValue([]);
  vi.mocked(listKimiSessions).mockResolvedValue([]);
  vi.mocked(listPiSessions).mockResolvedValue([]);
  vi.mocked(invalidateSessionIndexForWorkspace).mockResolvedValue(0);
  vi.mocked(listSessionIndexForWorkspace).mockResolvedValue({
    data: [],
    source: "session-index",
    synced: false,
    engines: [],
    visibility: { available: true, freshness: "verified", hiddenNativeIds: [] },
  });
  vi.mocked(getOpenCodeSessionList).mockResolvedValue([]);
  vi.mocked(listWorkspaceSessions).mockResolvedValue({
    data: [],
    nextCursor: null,
    partialSource: null,
  });
  vi.mocked(listWorkspaceSessionArchiveEvidence).mockResolvedValue({
    archivedAtBySessionId: {},
    partialSource: null,
    sourceStatuses: [],
  });
  vi.mocked(renameThreadTitleKey).mockResolvedValue(undefined);
  vi.mocked(setThreadTitle).mockResolvedValue("title");
  vi.mocked(connectWorkspace).mockResolvedValue(undefined);
  vi.mocked(previewThreadName).mockImplementation((text: string, fallback: string) => {
    const trimmed = text.trim();
    return trimmed || fallback;
  });
  vi.mocked(deleteClaudeSession).mockResolvedValue(undefined);
  vi.mocked(deleteGeminiSession).mockResolvedValue(undefined);
  vi.mocked(deleteGrokSession).mockResolvedValue(undefined);
  vi.mocked(deleteKimiSession).mockResolvedValue(undefined);
  vi.mocked(deleteOpenCodeSession).mockResolvedValue({
    deleted: true,
    method: "filesystem",
  });
  vi.mocked(deleteCodexSession).mockResolvedValue({
    deleted: true,
    deletedCount: 1,
    method: "filesystem",
    archivedBeforeDelete: true,
  });
  vi.mocked(loadGeminiSession).mockResolvedValue({ messages: [] });
  vi.mocked(loadGrokSession).mockResolvedValue({ messages: [] });
  vi.mocked(loadKimiSession).mockResolvedValue({ messages: [] });
  vi.mocked(loadPiSession).mockResolvedValue({ messages: [] });
  vi.mocked(readWorkspaceFile).mockResolvedValue({
    content: "",
    truncated: false,
  });
  vi.mocked(trashWorkspaceItem).mockResolvedValue(undefined);
  vi.mocked(writeWorkspaceFile).mockResolvedValue(undefined);
  vi.mocked(loadSidebarSnapshot).mockReturnValue(null);
  vi.mocked(mergeThreadItems).mockImplementation(
    (primaryItems: ConversationItem[]) => primaryItems,
  );
}
