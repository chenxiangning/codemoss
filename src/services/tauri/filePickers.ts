import { open } from "@tauri-apps/plugin-dialog";

export async function pickWorkspacePath(): Promise<string | null> {
  const selection = await open({ directory: true, multiple: false });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}

export async function pickImageFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif"],
      },
    ],
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function pickFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function pickWebAssetsArchive(): Promise<string | null> {
  const selection = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Web assets ZIP", extensions: ["zip"] }],
  });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}

/**
 * Pick a desktop application path for Open With targets.
 * macOS: prefers .app bundles; Windows: .exe; other: no filter.
 */
export async function pickApplicationPath(): Promise<string | null> {
  const platform =
    typeof navigator !== "undefined"
      ? (
          (navigator as Navigator & { userAgentData?: { platform?: string } })
            .userAgentData?.platform ??
          navigator.platform ??
          ""
        ).toLowerCase()
      : "";
  const isWindows = platform.includes("win");
  const isMac = platform.includes("mac");

  const selection = await open({
    multiple: false,
    directory: false,
    filters: isWindows
      ? [{ name: "Applications", extensions: ["exe", "cmd", "bat"] }]
      : isMac
        ? [{ name: "Applications", extensions: ["app"] }]
        : undefined,
  });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}
