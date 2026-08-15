import {
  HANDSHAKE_METHOD,
  HANDSHAKE_PROTOCOL_VERSION,
  NONCE_HEX_BYTES,
  ipcError,
  type IpcError,
} from "./constants";

const NONCE_RE = new RegExp(`^[0-9a-f]{${NONCE_HEX_BYTES * 2}}$`);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateHandshakeHello(value: unknown): { ok: true } | { ok: false; error: IpcError } {
  if (!isObject(value) || value.jsonrpc !== "2.0" || value.method !== HANDSHAKE_METHOD) {
    return { ok: false, error: ipcError("handshake-rejected", "hello must be mossx.handshake.hello") };
  }
  if (!isObject(value.params)) {
    return { ok: false, error: ipcError("handshake-rejected", "hello params required") };
  }
  const { protocolVersion, nonce, generation, coreContract } = value.params;
  if (protocolVersion !== HANDSHAKE_PROTOCOL_VERSION) {
    return { ok: false, error: ipcError("handshake-rejected", "protocolVersion must be 1") };
  }
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    return { ok: false, error: ipcError("handshake-rejected", "nonce must be 32-byte hex") };
  }
  if (typeof generation !== "number" || generation < 1) {
    return { ok: false, error: ipcError("handshake-rejected", "generation must be a positive integer") };
  }
  if (typeof coreContract !== "string" || !coreContract.trim()) {
    return { ok: false, error: ipcError("handshake-rejected", "coreContract required") };
  }
  return { ok: true };
}

export function validateHandshakeAck(
  value: unknown,
  expectedNonce: string,
): { ok: true } | { ok: false; error: IpcError } {
  if (!isObject(value) || value.jsonrpc !== "2.0" || !isObject(value.result)) {
    return { ok: false, error: ipcError("handshake-rejected", "ack must be a JSON-RPC result") };
  }
  const { protocolVersion, nonce, pluginId, version, generation } = value.result;
  if (protocolVersion !== HANDSHAKE_PROTOCOL_VERSION) {
    return { ok: false, error: ipcError("handshake-rejected", "ack protocolVersion must be 1") };
  }
  if (nonce !== expectedNonce) {
    return { ok: false, error: ipcError("handshake-rejected", "ack must echo hello nonce") };
  }
  if (typeof pluginId !== "string" || typeof version !== "string" || typeof generation !== "number") {
    return { ok: false, error: ipcError("handshake-rejected", "ack must declare pluginId/version/generation") };
  }
  return { ok: true };
}
