/**
 * Remote file-source hook (WSL plugin integration, ~40 lines).
 *
 * The wsl plugin registers an async reader + path classifier here at activate
 * time; the files store consults it before touching the local disk. Anything
 * the reader declines (null) falls through to the normal local read, so
 * non-WSL workspaces are untouched. Remote content is served read-only
 * (truncated: true) — remote writes are a later concern.
 *
 * Exposed on window because the plugin is a separately-bundled ESM module —
 * it cannot import host internals. Same-webview global is the contract.
 */

import type { FileContent } from "@/lib/ipc";
export type RemoteFileReader = (
  path: string,
) => Promise<FileContent | null>;

export interface CcguiFilesBridge {
  /** Register (or clear with null) the remote reader. */
  registerRemoteFileReader(reader: RemoteFileReader | null): void;
  /** Open a path in the center editor (the standard file-open flow). */
  openFile(path: string): Promise<void>;
  /** True when the path was served by the remote reader — saves blocked. */
  isRemote(path: string): boolean;
}

declare global {
  interface Window {
    __ccguiFiles?: CcguiFilesBridge;
  }
}

let remoteReader: RemoteFileReader | null = null;
const remotePaths = new Set<string>();

export function installFilesBridge(
  openFile: (path: string) => Promise<void>,
): void {
  window.__ccguiFiles = {
    registerRemoteFileReader(reader) {
      remoteReader = reader;
    },
    openFile,
    isRemote(path) {
      return remotePaths.has(path);
    },
  };
}

/** Read via the remote reader when it claims the path; null falls through. */
export async function readRemoteAware(
  path: string,
  localRead: (p: string) => Promise<FileContent>,
): Promise<FileContent> {
  if (remoteReader) {
    const content = await remoteReader(path);
    if (content !== null) {
      remotePaths.add(path);
      return { ...content, truncated: true };
    }
  }
  return localRead(path);
}

export function isKnownRemote(path: string): boolean {
  return remotePaths.has(path);
}
