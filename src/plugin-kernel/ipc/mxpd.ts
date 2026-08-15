import {
  FLAG_ACK,
  FLAG_CANCEL,
  FLAG_END,
  IPC_VERSION,
  MAX_PAYLOAD,
  MXPD_HEADER_BYTES,
  MXPD_MAGIC,
  RESERVED_FLAG_MASK,
  WINDOW_BYTES,
  WINDOW_FRAMES,
  ipcError,
  isKnownCodec,
  type IpcError,
} from "./constants";

export interface MxpdFrame {
  flags: number;
  streamId: number;
  seq: number;
  payload: Uint8Array;
}

export interface MxpdDecodeOk {
  frame: MxpdFrame;
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

export function encodeMxpd(frame: MxpdFrame): { ok: true; bytes: Uint8Array } | { ok: false; error: IpcError } {
  if ((frame.flags & RESERVED_FLAG_MASK) !== 0) {
    return { ok: false, error: ipcError("reserved-flag", `reserved MXPD flags set: ${frame.flags}`) };
  }
  if (frame.payload.length > MAX_PAYLOAD) {
    return { ok: false, error: ipcError("payload-too-large", `payload ${frame.payload.length} exceeds ${MAX_PAYLOAD}`) };
  }
  const bytes = new Uint8Array(MXPD_HEADER_BYTES + frame.payload.length);
  writeU32be(bytes, 0, MXPD_MAGIC);
  bytes[4] = IPC_VERSION;
  bytes[5] = frame.flags & 0xff;
  writeU32le(bytes, 6, frame.streamId >>> 0);
  writeU32le(bytes, 10, frame.seq >>> 0);
  writeU32le(bytes, 14, frame.payload.length);
  bytes.set(frame.payload, MXPD_HEADER_BYTES);
  return { ok: true, bytes };
}

export function decodeMxpd(bytes: Uint8Array): { ok: true; value: MxpdDecodeOk } | { ok: false; error: IpcError } {
  if (bytes.length < MXPD_HEADER_BYTES) {
    return { ok: false, error: ipcError("need-more", "incomplete MXPD header") };
  }
  const magic = readU32be(bytes, 0);
  if (magic !== MXPD_MAGIC) {
    return { ok: false, error: ipcError("bad-magic", `expected MXPD, got 0x${magic.toString(16)}`) };
  }
  const version = bytes[4] ?? 0;
  if (version !== IPC_VERSION) {
    return { ok: false, error: ipcError("unsupported-version", `version ${version} is not 1`) };
  }
  const flags = bytes[5] ?? 0;
  if ((flags & RESERVED_FLAG_MASK) !== 0) {
    return { ok: false, error: ipcError("reserved-flag", `reserved MXPD flags set: ${flags}`) };
  }
  const payloadLen = readU32le(bytes, 14);
  if (payloadLen > MAX_PAYLOAD) {
    return { ok: false, error: ipcError("payload-too-large", `payload_len ${payloadLen} exceeds ${MAX_PAYLOAD}`) };
  }
  if (bytes.length < MXPD_HEADER_BYTES + payloadLen) {
    return { ok: false, error: ipcError("truncated", "data frame payload is incomplete") };
  }
  return {
    ok: true,
    value: {
      frame: {
        flags,
        streamId: readU32le(bytes, 6),
        seq: readU32le(bytes, 10),
        payload: bytes.subarray(MXPD_HEADER_BYTES, MXPD_HEADER_BYTES + payloadLen),
      },
      rest: bytes.subarray(MXPD_HEADER_BYTES + payloadLen),
    },
  };
}

export function assertKnownCodec(codec: string): IpcError | null {
  if (!isKnownCodec(codec)) return ipcError("unknown-codec", `codec ${codec} is not a V1 codec`);
  return null;
}

export function canSend(unackedFrames: number, unackedBytes: number, nextPayloadBytes: number): IpcError | null {
  if (unackedFrames >= WINDOW_FRAMES || unackedBytes + nextPayloadBytes > WINDOW_BYTES) {
    return ipcError("window-exceeded", "unacked window is 32 frames or 8 MiB");
  }
  return null;
}

export const MXPD_FLAG = { END: FLAG_END, CANCEL: FLAG_CANCEL, ACK: FLAG_ACK } as const;
