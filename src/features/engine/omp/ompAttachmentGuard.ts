/**
 * OMP attachment 消费边界（8.4）。
 * Rust 侧 ACP content normalization 产出 canonical block（与 grok/qoder/pi 同一 shape）：
 *   image         → { type: "image", mimeType, data(base64) }
 *   file          → { type: "resource_link", uri: "file://<abs>", name }
 *   text          → { type: "text", text }
 * 本模块是渲染前的最后一道 guard：raw ACP/RPC protocol frame 绝不直达 UI（design Decision 4），
 * 且不引入 claude source{media_type} 之类的平行 shape。
 */

export type OmpCanonicalAttachmentBlock =
  | Readonly<{ type: "image"; mimeType: string; data: string }>
  | Readonly<{ type: "resource_link"; uri: string; name: string }>
  | Readonly<{ type: "text"; text: string }>;

/** svg 等可执行 markup 的 mime 不在渲染 allowlist 内。 */
export const OMP_IMAGE_MIME_ALLOWLIST: readonly string[] = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** 渲染前防御上限（base64 字符数）；Rust 侧 oversize 已在 normalization 拒绝，这里是第二道。 */
export const OMP_ATTACHMENT_MAX_BASE64_CHARS = 16_000_000;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const RAW_CONTROL_TYPES: readonly string[] = [
  "ready",
  "response",
  "available_commands_update",
  "extension_ui_request",
  "job_started",
  "job_updated",
  "job_completed",
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** raw ACP/RPC frame 识别：jsonrpc/method/sessionUpdate/已知 control type 一律算 raw。 */
export function looksLikeOmpRawProtocolFrame(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  if ("jsonrpc" in value || typeof value.method === "string") {
    return true;
  }
  const params = value.params;
  if (isPlainObject(params) && isPlainObject(params.update) && "sessionUpdate" in params.update) {
    return true;
  }
  return typeof value.type === "string" && RAW_CONTROL_TYPES.includes(value.type);
}

export function isOmpCanonicalAttachmentBlock(
  value: unknown,
): value is OmpCanonicalAttachmentBlock {
  if (!isPlainObject(value)) {
    return false;
  }
  if (value.type === "image") {
    return typeof value.mimeType === "string" && typeof value.data === "string";
  }
  if (value.type === "resource_link") {
    return typeof value.uri === "string" && typeof value.name === "string";
  }
  if (value.type === "text") {
    return typeof value.text === "string";
  }
  return false;
}

export type OmpAttachmentRenderVerdict =
  | Readonly<{ ok: true; block: OmpCanonicalAttachmentBlock }>
  | Readonly<{
      ok: false;
      reason:
        | "raw-protocol-frame"
        | "unknown-block"
        | "unsupported-mime"
        | "invalid-payload"
        | "invalid-uri";
    }>;

/**
 * 渲染前校验。拒绝顺序固定：raw frame → 非 canonical shape → mime allowlist → payload/uri。
 */
export function validateOmpAttachmentForRender(value: unknown): OmpAttachmentRenderVerdict {
  if (looksLikeOmpRawProtocolFrame(value)) {
    return { ok: false, reason: "raw-protocol-frame" };
  }
  if (!isOmpCanonicalAttachmentBlock(value)) {
    return { ok: false, reason: "unknown-block" };
  }
  if (value.type === "text") {
    return { ok: true, block: value };
  }
  if (value.type === "image") {
    if (!OMP_IMAGE_MIME_ALLOWLIST.includes(value.mimeType)) {
      return { ok: false, reason: "unsupported-mime" };
    }
    const data = value.data;
    const validPayload =
      data.length > 0 &&
      data.length <= OMP_ATTACHMENT_MAX_BASE64_CHARS &&
      !data.startsWith("data:") &&
      BASE64_PATTERN.test(data);
    if (!validPayload) {
      return { ok: false, reason: "invalid-payload" };
    }
    return { ok: true, block: value };
  }
  // resource_link：仅放行绝对 file:// uri 且 name 非空。
  const validUri =
    value.uri.startsWith("file:///") &&
    value.uri.length > "file:///".length &&
    value.name.trim().length > 0;
  if (!validUri) {
    return { ok: false, reason: "invalid-uri" };
  }
  return { ok: true, block: value };
}
