function normalizeComparableBrowserUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURI(trimmed).replace(/\/+$/, "") || trimmed;
  } catch {
    return trimmed.replace(/\/+$/, "") || trimmed;
  }
}

/** 判断两个浏览器 URL 是否指向同一资源（忽略编码差异与末尾 /）。 */
export function urlsPointToSameBrowserResource(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const first = normalizeComparableBrowserUrl(left ?? "");
  const second = normalizeComparableBrowserUrl(right ?? "");
  if (!first || !second) {
    return false;
  }
  return first === second;
}
