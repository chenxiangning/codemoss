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

export type SharedNativeVisibilityProjection = {
  available: boolean;
  freshness?: string | null;
  hiddenNativeIds?: string[] | null;
  protocolHiddenNativeIds?: string[] | null;
  reason?: string | null;
};

export type SessionIndexListPage = {
  data: SessionIndexRow[];
  source: string;
  synced: boolean;
  syncMs?: number | null;
  engines: string[];
  partialSource?: string | null;
  visibility?: SharedNativeVisibilityProjection | null;
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

/** Hide Index rows so sidebar hydrate cannot resurrect a deleted session. */
export function writeClientCreatedSessionIndex(input: {
  engine: string;
  sessionId: string;
  workspacePath: string;
  title?: string;
}): void {
  const engine = input.engine.trim().toLowerCase();
  const rawId = input.sessionId.trim();
  const workspacePath = input.workspacePath.trim();
  if (!engine || engine === "shared" || !rawId || !workspacePath) {
    return;
  }
  const sessionId = rawId.includes(":")
    ? rawId.slice(rawId.indexOf(":") + 1).trim()
    : rawId;
  if (!sessionId) {
    return;
  }
  void upsertSessionIndexRows([
    {
      engine,
      sessionId,
      title: input.title?.trim() || `${engine} session`,
      updatedAt: Date.now(),
      workspacePath,
      cwd: workspacePath,
    },
  ]).catch(() => 0);
}

export async function upsertSessionIndexRows(
  rows: SessionIndexRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  return invoke<number>("upsert_session_index_rows", { rows });
}

export async function tombstoneSessionIndexRows(
  sessionIds: string[],
): Promise<number> {
  const ids = sessionIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return 0;
  }
  return invoke<number>("tombstone_session_index_rows", {
    sessionIds: ids,
  });
}
