type BrowserTabLabelSource = {
  title?: string | null;
  url?: string | null;
  normalizedUrl?: string | null;
};

function isUrlLikeTitle(title: string, url: string): boolean {
  if (!title) {
    return true;
  }
  if (title === url) {
    return true;
  }
  return /^(?:https?:|file:)/i.test(title);
}

function lastPathSegment(url: string): string | null {
  const raw = url.split(/[?#]/)[0] ?? url;
  try {
    const parsed = new URL(raw);
    const decoded = decodeURIComponent(parsed.pathname);
    const parts = decoded.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    const parts = raw.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  }
}

export function resolveBrowserTabLabel(session: BrowserTabLabelSource): string {
  const url = session.normalizedUrl || session.url || "";
  const title = session.title?.trim() ?? "";
  if (title && !isUrlLikeTitle(title, url)) {
    return title;
  }
  const fileName = lastPathSegment(url);
  if (fileName && (url.startsWith("file:") || fileName.includes("."))) {
    return fileName;
  }
  try {
    const hostname = new URL(url).hostname;
    if (hostname) {
      return hostname;
    }
  } catch {
    // Keep falling through to filename / raw URL.
  }
  return fileName || url || title;
}
