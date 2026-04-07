export const DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT = "detached-file-tree:drag-bridge";
export const DETACHED_FILE_TREE_DRAG_SNAPSHOT_STORAGE_KEY = "detachedFileTreeDragSnapshot";
const DETACHED_FILE_TREE_DRAG_MAX_AGE_MS = 15_000;

export type DetachedFileTreeDragBridgePayload = {
  type: "start";
  paths: string[];
};

type DetachedFileTreeDragSnapshot = {
  paths: string[];
  stamp: number;
};

function normalizePaths(paths: string[]): string[] {
  return paths
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function writeDetachedFileTreeDragSnapshot(paths: string[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  const normalizedPaths = normalizePaths(paths);
  if (normalizedPaths.length === 0) {
    return;
  }
  const snapshot: DetachedFileTreeDragSnapshot = {
    paths: normalizedPaths,
    stamp: Date.now(),
  };
  try {
    window.localStorage.setItem(
      DETACHED_FILE_TREE_DRAG_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore local storage write errors.
  }
}

export function readDetachedFileTreeDragSnapshot(
  maxAgeMs = DETACHED_FILE_TREE_DRAG_MAX_AGE_MS,
): string[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(DETACHED_FILE_TREE_DRAG_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as DetachedFileTreeDragSnapshot | null;
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    if (typeof parsed.stamp !== "number" || Date.now() - parsed.stamp > maxAgeMs) {
      return [];
    }
    if (!Array.isArray(parsed.paths)) {
      return [];
    }
    return normalizePaths(parsed.paths);
  } catch {
    return [];
  }
}

export function clearDetachedFileTreeDragSnapshot(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(DETACHED_FILE_TREE_DRAG_SNAPSHOT_STORAGE_KEY);
  } catch {
    // Ignore local storage remove errors.
  }
}
