import {
  IPC_VERSION,
  MAX_PAYLOAD,
  MXPC_HEADER_BYTES,
  MXPC_MAGIC,
  ipcError,
  type IpcError,
} from "./constants";

export interface MxpcDecodeOk {
  message: Record<string, unknown>;
  rest: Uint8Array;
}

function readU32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function writeU32be(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readU32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function writeU32le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function looksLikeNdjson(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const first = bytes[0];
  if (first === 0x7b || first === 0x0a || first === 0x0d) return true;
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 32)));
  return text.includes("\n{") || text.startsWith("{");
}

export function encodeMxpc(message: unknown): { ok: true; bytes: Uint8Array } | { ok: false; error: IpcError } {
  let json: string;
  try {
    json = JSON.stringify(message);
  } catch {
    return { ok: false, error: ipcError("invalid-json", "control payload is not JSON-serializable") };
  }
  const payload = new TextEncoder().encode(json);
  if (payload.length > MAX_PAYLOAD) {
    return { ok: false, error: ipcError("payload-too-large", `payload ${payload.length} exceeds ${MAX_PAYLOAD}`) };
  }
  const bytes = new Uint8Array(MXPC_HEADER_BYTES + payload.length);
  writeU32be(bytes, 0, MXPC_MAGIC);
  bytes[4] = IPC_VERSION;
  bytes[5] = 0;
  writeU32le(bytes, 6, payload.length);
  bytes.set(payload, MXPC_HEADER_BYTES);
  return { ok: true, bytes };
}

export function decodeMxpc(bytes: Uint8Array): { ok: true; value: MxpcDecodeOk } | { ok: false; error: IpcError } {
  if (bytes.length === 0) {
    return { ok: false, error: ipcError("need-more", "empty buffer") };
  }
  if (bytes.length < MXPC_HEADER_BYTES) {
    if (looksLikeNdjson(bytes)) {
      return { ok: false, error: ipcError("ndjson-forbidden", "control payload is newline JSON, not MXPC") };
    }
    return { ok: false, error: ipcError("need-more", "incomplete MXPC header") };
  }
  const magic = readU32be(bytes, 0);
  if (magic !== MXPC_MAGIC) {
    if (looksLikeNdjson(bytes)) {
      return { ok: false, error: ipcError("ndjson-forbidden", "control payload is newline JSON, not MXPC") };
    }
    return { ok: false, error: ipcError("bad-magic", `expected MXPC, got 0x${magic.toString(16)}`) };
  }
  const version = bytes[4] ?? 0;
  if (version !== IPC_VERSION) {
    return { ok: false, error: ipcError("unsupported-version", `version ${version} is not 1`) };
  }
  const flags = bytes[5] ?? 0;
  if (flags !== 0) {
    return { ok: false, error: ipcError("reserved-flag", `MXPC flags must be 0, got ${flags}`) };
  }
  const payloadLen = readU32le(bytes, 6);
  if (payloadLen > MAX_PAYLOAD) {
    return { ok: false, error: ipcError("payload-too-large", `payload_len ${payloadLen} exceeds ${MAX_PAYLOAD}`) };
  }
  if (bytes.length < MXPC_HEADER_BYTES + payloadLen) {
    return { ok: false, error: ipcError("truncated", "control frame payload is incomplete") };
  }
  const payload = bytes.subarray(MXPC_HEADER_BYTES, MXPC_HEADER_BYTES + payloadLen);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown;
  } catch {
    return { ok: false, error: ipcError("invalid-json", "MXPC payload is not UTF-8 JSON") };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: ipcError("invalid-json", "MXPC payload must be a JSON object") };
  }
  return {
    ok: true,
    value: {
      message: parsed as Record<string, unknown>,
      rest: bytes.subarray(MXPC_HEADER_BYTES + payloadLen),
    },
  };
}
