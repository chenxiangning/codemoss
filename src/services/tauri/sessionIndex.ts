import { invoke } from "@tauri-apps/api/core";

export type SessionIndexEngine =
  | "claude"
  | "codex"
  | "gemini"
  | "grok"
  | "kimi"
  | "opencode"
  | string;

export type SessionIndexRow = {
  engine: SessionIndexEngine;
  sessionId: string;
  title: string;
  nativeTitle?: string | null;
  updatedAt: number;
  createdAt?: number | null;
  cwd?: string | null;
  workspacePath?: string | null;
  physicalPath?: string | null;
  parentSessionId?: string | null;
  sizeBytes?: number | null;
};

export type SessionIndexListPage = {
  data: SessionIndexRow[];
  source: string;
  synced: boolean;
  syncMs?: number | null;
  engines: string[];
  partialSource?: string | null;
};

export type SessionIndexSyncReport = {
  upserted: number;
  engines: string[];
  durationMs: number;
  partialSource?: string | null;
  skippedFresh: boolean;
};

export async function listSessionIndexForWorkspace(
  workspaceId: string,
  options?: {
    limit?: number | null;
    syncIfNeeded?: boolean | null;
    forceSync?: boolean | null;
  },
): Promise<SessionIndexListPage> {
  return invoke<SessionIndexListPage>("list_session_index_for_workspace", {
    workspaceId,
    limit: options?.limit ?? null,
    syncIfNeeded: options?.syncIfNeeded ?? true,
    forceSync: options?.forceSync ?? false,
  });
}

export async function syncSessionIndexForWorkspace(
  workspaceId: string,
  options?: {
    limit?: number | null;
    force?: boolean | null;
  },
): Promise<SessionIndexSyncReport> {
  return invoke<SessionIndexSyncReport>("sync_session_index_for_workspace", {
    workspaceId,
    limit: options?.limit ?? null,
    force: options?.force ?? false,
  });
}

/** Soft-invalidate SQLite source freshness so next list/sync rescans engines. */
export async function invalidateSessionIndexForWorkspace(
  workspaceId: string,
): Promise<number> {
  return invoke<number>("invalidate_session_index_for_workspace", {
    workspaceId,
  });
}
