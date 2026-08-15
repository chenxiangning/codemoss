import constants from "../../../packages/plugin-contract/schemas/ipc/constants.v1.json";

export const MXPC_MAGIC = constants.mxpc.magicU32be;
export const MXPD_MAGIC = constants.mxpd.magicU32be;
export const IPC_VERSION = constants.mxpc.version;
export const MXPC_HEADER_BYTES = constants.mxpc.headerBytes;
export const MXPD_HEADER_BYTES = constants.mxpd.headerBytes;
export const MAX_PAYLOAD = constants.mxpc.maxPayload;
export const WINDOW_FRAMES = constants.window.maxUnackedFrames;
export const WINDOW_BYTES = constants.window.maxUnackedBytes;
export const FLAG_END = constants.mxpd.flagEnd;
export const FLAG_CANCEL = constants.mxpd.flagCancel;
export const FLAG_ACK = constants.mxpd.flagAck;
export const RESERVED_FLAG_MASK = constants.mxpd.reservedMask;
export const V1_CODECS = constants.codecs as readonly string[];
export const HANDSHAKE_METHOD = constants.handshake.method;
export const HANDSHAKE_PROTOCOL_VERSION = constants.handshake.protocolVersion;
export const NONCE_HEX_BYTES = constants.handshake.nonceHexBytes;

export type IpcErrorCode =
  | "need-more"
  | "bad-magic"
  | "unsupported-version"
  | "reserved-flag"
  | "payload-too-large"
  | "truncated"
  | "invalid-json"
  | "ndjson-forbidden"
  | "unknown-codec"
  | "handshake-rejected"
  | "window-exceeded";

export interface IpcError {
  code: IpcErrorCode;
  message: string;
}

export function ipcError(code: IpcErrorCode, message: string): IpcError {
  return { code, message };
}

export function isKnownCodec(codec: string): boolean {
  return (V1_CODECS as readonly string[]).includes(codec);
}
