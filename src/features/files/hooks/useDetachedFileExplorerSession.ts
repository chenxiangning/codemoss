import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DETACHED_FILE_EXPLORER_SESSION_EVENT,
  type DetachedFileExplorerSession,
  normalizeDetachedFileExplorerSession,
  readDetachedFileExplorerSessionSnapshot,
  writeDetachedFileExplorerSessionSnapshot,
} from "../detachedFileExplorer";

export function useDetachedFileExplorerSession() {
  const [session, setSession] = useState<DetachedFileExplorerSession | null>(() =>
    readDetachedFileExplorerSessionSnapshot(),
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    try {
      const currentWindow = getCurrentWindow();
      currentWindow
        .listen<DetachedFileExplorerSession>(
          DETACHED_FILE_EXPLORER_SESSION_EVENT,
          (event) => {
            const nextSession = normalizeDetachedFileExplorerSession(event.payload);
            if (!nextSession) {
              return;
            }
            writeDetachedFileExplorerSessionSnapshot(nextSession);
            setSession(nextSession);
          },
        )
        .then((handler) => {
          unlisten = handler;
        })
        .catch(() => {});
    } catch {
      // Non-Tauri test environments fall back to the persisted snapshot only.
    }

    return () => {
      unlisten?.();
    };
  }, []);

  return session;
}
