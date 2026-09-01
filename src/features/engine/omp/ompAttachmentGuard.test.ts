import { describe, expect, it } from "vitest";
import {
  isOmpCanonicalAttachmentBlock,
  looksLikeOmpRawProtocolFrame,
  OMP_IMAGE_MIME_ALLOWLIST,
  validateOmpAttachmentForRender,
} from "./ompAttachmentGuard";

const imageBlock = {
  type: "image",
  mimeType: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUg==",
} as const;

const resourceLinkBlock = {
  type: "resource_link",
  uri: "file:///data/shared/report.md",
  name: "report.md",
} as const;

describe("OMP attachment consumption boundary (8.4)", () => {
  it("accepts the canonical image content block produced by ACP normalization", () => {
    expect(isOmpCanonicalAttachmentBlock(imageBlock)).toBe(true);
    const verdict = validateOmpAttachmentForRender(imageBlock);
    expect(verdict).toEqual({ ok: true, block: imageBlock });
  });

  it("accepts canonical resource_link and text blocks", () => {
    expect(validateOmpAttachmentForRender(resourceLinkBlock)).toEqual({
      ok: true,
      block: resourceLinkBlock,
    });
    const textBlock = { type: "text", text: "hello" } as const;
    expect(validateOmpAttachmentForRender(textBlock)).toEqual({ ok: true, block: textBlock });
  });

  it("rejects raw ACP/RPC protocol frames so they never reach the UI", () => {
    const rawFrames = [
      { jsonrpc: "2.0", id: 1, method: "session/update", params: {} },
      { type: "ready", protocolVersion: 1 },
      { type: "extension_ui_request", params: { view: {} } },
      { method: "session/update", params: { update: { sessionUpdate: "tool_call" } } },
    ];
    for (const frame of rawFrames) {
      expect(looksLikeOmpRawProtocolFrame(frame)).toBe(true);
      expect(validateOmpAttachmentForRender(frame)).toEqual({
        ok: false,
        reason: "raw-protocol-frame",
      });
    }
  });

  it("rejects the claude-style source shape to avoid parallel attachment types", () => {
    const claudeShape = {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" },
    };
    expect(isOmpCanonicalAttachmentBlock(claudeShape)).toBe(false);
    expect(validateOmpAttachmentForRender(claudeShape)).toEqual({
      ok: false,
      reason: "unknown-block",
    });
  });

  it("rejects image blocks with a mime outside the render allowlist", () => {
    expect(OMP_IMAGE_MIME_ALLOWLIST).not.toContain("image/svg+xml");
    const verdict = validateOmpAttachmentForRender({
      type: "image",
      mimeType: "image/svg+xml",
      data: "PHN2Zz48L3N2Zz4=",
    });
    expect(verdict).toEqual({ ok: false, reason: "unsupported-mime" });
  });

  it("rejects image blocks with empty, data-url-prefixed or non-base64 payloads", () => {
    for (const data of ["", "  ", "data:image/png;base64,iVBORw0KGgo=", "not base64!!!"]) {
      expect(
        validateOmpAttachmentForRender({ type: "image", mimeType: "image/png", data }),
      ).toEqual({ ok: false, reason: "invalid-payload" });
    }
  });

  it("rejects resource_link blocks without an absolute file uri or a name", () => {
    expect(
      validateOmpAttachmentForRender({ type: "resource_link", uri: "https://evil.example/x", name: "x" }),
    ).toEqual({ ok: false, reason: "invalid-uri" });
    expect(
      validateOmpAttachmentForRender({ type: "resource_link", uri: "file://relative/path", name: "x" }),
    ).toEqual({ ok: false, reason: "invalid-uri" });
    expect(
      validateOmpAttachmentForRender({ type: "resource_link", uri: "file:///data/a.md", name: " " }),
    ).toEqual({ ok: false, reason: "invalid-uri" });
  });
});
