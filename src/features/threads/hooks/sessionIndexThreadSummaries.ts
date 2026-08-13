import type { ThreadSummary } from "../../../types";
import type { SessionIndexRow } from "../../../services/tauri";
import { previewThreadName } from "../../../utils/threadItems";
import { sanitizeNativeSessionTitle } from "../utils/sessionDisplayProjection";
import { shouldExcludeOrdinaryNativeRow } from "./sharedNativeVisibility";

const ENGINE_PREFIX: Record<string, string> = {
  claude: "claude:",
  codex: "",
  gemini: "gemini:",
  grok: "grok:",
  kimi: "kimi:",
  pi: "pi:",
  opencode: "opencode:",
};

function normalizeEngine(
  engine: string | null | undefined,
): ThreadSummary["engineSource"] | null {
  const value = String(engine ?? "")
    .trim()
    .toLowerCase();
  if (
    value === "claude" ||
    value === "codex" ||
    value === "gemini" ||
    value === "grok" ||
    value === "kimi" ||
    value === "pi" ||
    value === "opencode"
  ) {
    return value;
  }
  return null;
}

export function sessionIndexRowToThreadId(row: SessionIndexRow): string | null {
  const engine = normalizeEngine(row.engine);
  const sessionId = String(row.sessionId ?? "").trim();
  if (!engine || !sessionId) {
    return null;
  }
  if (sessionId.includes(":")) {
    return sessionId;
  }
  const prefix = ENGINE_PREFIX[engine] ?? `${engine}:`;
  return `${prefix}${sessionId}`;
}

export function filterSessionIndexRowsByEngine(
  rows: SessionIndexRow[],
  engine: string,
): SessionIndexRow[] {
  const wanted = engine.trim().toLowerCase();
  if (!wanted) {
    return [];
  }
  return rows.filter(
    (row) =>
      String(row.engine ?? "")
        .trim()
        .toLowerCase() === wanted,
  );
}

export function sessionIndexRowsToThreadSummaries(
  rows: SessionIndexRow[],
  options: {
    workspaceId: string;
    mappedTitles: Record<string, string>;
    getCustomName: (workspaceId: string, threadId: string) => string | undefined;
    hiddenSharedBindingIds?: Set<string>;
  },
): ThreadSummary[] {
  const hidden = options.hiddenSharedBindingIds ?? new Set<string>();
  const out: ThreadSummary[] = [];
  for (const row of rows) {
    const engine = normalizeEngine(row.engine);
    const id = sessionIndexRowToThreadId(row);
    if (!engine || !id) {
      continue;
    }
    if (
      shouldExcludeOrdinaryNativeRow(id, hidden) ||
      shouldExcludeOrdinaryNativeRow(row.sessionId, hidden)
    ) {
      continue;
    }
    const nativeTitle = sanitizeNativeSessionTitle(
      String(row.nativeTitle ?? "").trim(),
    );
    const title = String(row.title ?? "").trim();
    const fallback =
      engine === "claude"
        ? "Claude Session"
        : engine === "codex"
          ? "Codex Session"
          : engine === "kimi"
            ? "Kimi Session"
            : engine === "gemini"
              ? "Gemini Session"
              : engine === "grok"
                ? "Grok Session"
                : engine === "pi"
                  ? "PI Session"
                  : "Session";
    const mappedTitle = options.mappedTitles[id];
    const customName =
      options.getCustomName(options.workspaceId, id) || mappedTitle;
    const name =
      customName ||
      nativeTitle ||
      (title ? previewThreadName(title, fallback) : fallback);
    const updatedAt =
      typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt)
        ? Math.max(0, row.updatedAt)
        : 0;
    const sizeBytes =
      typeof row.sizeBytes === "number" && Number.isFinite(row.sizeBytes)
        ? Math.max(0, row.sizeBytes)
        : undefined;
    const parentRaw = String(row.parentSessionId ?? "").trim();
    const parentThreadId = parentRaw
      ? parentRaw.includes(":")
        ? parentRaw
        : `${ENGINE_PREFIX[engine] ?? `${engine}:`}${parentRaw}`
      : null;
    out.push({
      id,
      name,
      updatedAt,
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
      ...(row.physicalPath
        ? { physicalPath: String(row.physicalPath) }
        : {}),
      engineSource: engine,
      threadKind: "native",
      ...(parentThreadId ? { parentThreadId } : {}),
    });
  }
  return out;
}

/**
 * Seed index rows into an existing merge map without overwriting newer live rows.
 */
export function mergeSessionIndexRowsIntoSummaries(
  existing: ThreadSummary[],
  indexRows: SessionIndexRow[],
  options: {
    workspaceId: string;
    mappedTitles: Record<string, string>;
    getCustomName: (workspaceId: string, threadId: string) => string | undefined;
    hiddenSharedBindingIds?: Set<string>;
  },
): ThreadSummary[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const indexSummaries = sessionIndexRowsToThreadSummaries(indexRows, options);
  for (const summary of indexSummaries) {
    const prev = byId.get(summary.id);
    if (!prev || summary.updatedAt >= prev.updatedAt) {
      // Prefer live/catalog identity fields when present.
      byId.set(
        summary.id,
        prev
          ? {
              ...summary,
              name: prev.name || summary.name,
              folderId: prev.folderId ?? summary.folderId,
              autoSession: prev.autoSession ?? summary.autoSession,
              providerProfileId:
                prev.providerProfileId ?? summary.providerProfileId,
              parentThreadId: prev.parentThreadId ?? summary.parentThreadId,
            }
          : summary,
      );
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
