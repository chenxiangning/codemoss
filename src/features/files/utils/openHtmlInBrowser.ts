import { requestBrowserDockOpenUrl } from "@mossx/plugin-browser/runtime";

const HTML_FILE_EXTENSION_PATTERN = /\.(html|htm)$/i;

export type OpenHtmlInBrowserOptions = {
  workspaceId: string;
};

/** 打开失败的用户可读分类（对应 i18n，不直接展示后端英文）。 */
export type OpenHtmlInBrowserErrorKind =
  | "no-workspace"
  | "window-busy"
  | "blocked"
  | "failed";

const OPEN_HTML_IN_BROWSER_ERROR_I18N_KEYS: Record<
  OpenHtmlInBrowserErrorKind,
  string
> = {
  "no-workspace": "files.openInBrowserNoWorkspace",
  "window-busy": "files.openInBrowserWindowBusy",
  blocked: "files.openInBrowserBlocked",
  failed: "files.openInBrowserFailed",
};

/** 判定路径是否为 HTML 文件（.html / .htm，大小写不敏感）。 */
export function isHtmlFilePath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) {
    return false;
  }
  return HTML_FILE_EXTENSION_PATTERN.test(trimmed.replace(/\\/g, "/"));
}

/**
 * 将本地绝对路径转为 file:// URL。
 * 分段 encodeURIComponent，保留 Windows 盘符冒号，避免空格/中文/#/? 破坏 URL。
 */
export function buildLocalFileUrl(absolutePath: string): string {
  const normalized = absolutePath.trim().replace(/\\/g, "/");
  if (!normalized) {
    return "file:///";
  }

  const segments = normalized.split("/");
  const encoded = segments
    .map((segment, index) => {
      if (segment === "") {
        return "";
      }
      // Windows 盘符段：C: 保留冒号
      if (index === 0 && /^[a-zA-Z]:$/.test(segment)) {
        return segment;
      }
      return encodeURIComponent(segment);
    })
    .join("/");

  if (encoded.startsWith("/")) {
    return `file://${encoded}`;
  }
  return `file:///${encoded}`;
}

/** 将打开失败映射为用户可读错误类别（不暴露原始英文技术串）。 */
export function resolveOpenHtmlInBrowserErrorKind(
  error: unknown,
): OpenHtmlInBrowserErrorKind {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    /workspaceid is required|no workspace|select a workspace|openinbrowsernoworkspace/.test(
      lower,
    )
  ) {
    return "no-workspace";
  }
  if (/already exists|webview with label/.test(lower)) {
    return "window-busy";
  }
  if (
    /blocked|not allowed|blocked_file_type|blocked_scheme|policy/.test(lower)
  ) {
    return "blocked";
  }
  return "failed";
}

/**
 * 将打开失败转为 i18n 文案。
 * 调用方应使用全局 toast 展示，禁止把原始 error.message 直接给用户。
 */
export function formatOpenHtmlInBrowserError(
  error: unknown,
  t: (key: string) => string,
): string {
  const kind = resolveOpenHtmlInBrowserErrorKind(error);
  return t(OPEN_HTML_IN_BROWSER_ERROR_I18N_KEYS[kind]);
}

/**
 * 用应用内置 Browser Agent 打开本地 HTML（file://）。
 * 走内嵌 dock 事件链路（与 Composer 网址导航一致）：打开中心分屏 dock 并投递 URL，
 * 会话创建/挂载由 BrowserDock 接管；校验失败在岛内 notice 呈现。
 * 无工作区等前置失败仍 reject，由调用方用 formatOpenHtmlInBrowserError + 全局 toast 提示。
 */
export async function openHtmlInBrowser(
  absolutePath: string,
  options: OpenHtmlInBrowserOptions,
): Promise<void> {
  const workspaceId = options.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("workspaceId is required to open HTML in the built-in browser");
  }

  const fileUrl = buildLocalFileUrl(absolutePath);
  requestBrowserDockOpenUrl(fileUrl);
}
