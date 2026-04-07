import { useEffect, useRef, useState } from "react";
import type { EditorNavigationTarget } from "../../app/hooks/useGitPanelController";

type EditorNavigationLocation = {
  line: number;
  column: number;
};

export function useDetachedFileExplorerState(
  workspaceId: string | null,
  initialFilePath?: string | null,
  sessionUpdatedAt?: number | null,
) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] =
    useState<EditorNavigationTarget | null>(null);
  const navigationRequestIdRef = useRef(0);
  const lastWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousWorkspaceId = lastWorkspaceIdRef.current;
    lastWorkspaceIdRef.current = workspaceId;
    const normalizedInitialFilePath = initialFilePath?.trim() || null;
    if (!workspaceId) {
      setOpenTabs([]);
      setActiveFilePath(null);
      setNavigationTarget(null);
      navigationRequestIdRef.current = 0;
      return;
    }
    if (previousWorkspaceId !== workspaceId) {
      setOpenTabs(normalizedInitialFilePath ? [normalizedInitialFilePath] : []);
      setActiveFilePath(normalizedInitialFilePath);
      setNavigationTarget(null);
      navigationRequestIdRef.current = 0;
      return;
    }
    if (!normalizedInitialFilePath) {
      return;
    }
    setOpenTabs((current) =>
      current.includes(normalizedInitialFilePath)
        ? current
        : [...current, normalizedInitialFilePath],
    );
    setActiveFilePath(normalizedInitialFilePath);
    setNavigationTarget(null);
  }, [initialFilePath, sessionUpdatedAt, workspaceId]);

  const openFile = (path: string, location?: EditorNavigationLocation) => {
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActiveFilePath(path);
    if (!location) {
      setNavigationTarget(null);
      return;
    }
    navigationRequestIdRef.current += 1;
    setNavigationTarget({
      path,
      line: location.line,
      column: location.column,
      requestId: navigationRequestIdRef.current,
    });
  };

  const activateTab = (path: string) => {
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActiveFilePath(path);
    setNavigationTarget(null);
  };

  const closeTab = (path: string) => {
    setOpenTabs((current) => {
      const closingIndex = current.indexOf(path);
      if (closingIndex < 0) {
        return current;
      }
      const nextTabs = current.filter((entry) => entry !== path);
      setActiveFilePath((currentActivePath) => {
        if (currentActivePath && currentActivePath !== path) {
          return nextTabs.includes(currentActivePath) ? currentActivePath : nextTabs[0] ?? null;
        }
        return nextTabs[closingIndex] ?? nextTabs[closingIndex - 1] ?? null;
      });
      setNavigationTarget((currentTarget) =>
        currentTarget?.path === path ? null : currentTarget,
      );
      return nextTabs;
    });
  };

  const closeAllTabs = () => {
    setOpenTabs([]);
    setActiveFilePath(null);
    setNavigationTarget(null);
  };

  return {
    openTabs,
    activeFilePath,
    navigationTarget,
    openFile,
    activateTab,
    closeTab,
    closeAllTabs,
  };
}
