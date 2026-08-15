import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import constants from "../../../packages/plugin-contract/schemas/ipc/constants.v1.json";
import hello from "../../../packages/plugin-contract/fixtures/ipc/valid/handshake-hello.json";
import ack from "../../../packages/plugin-contract/fixtures/ipc/valid/handshake-ack.json";
import { MAX_PAYLOAD, MXPC_MAGIC, MXPD_MAGIC, WINDOW_BYTES, WINDOW_FRAMES, type IpcError } from "./constants";
import { validateHandshakeAck, validateHandshakeHello } from "./handshake";
import { decodeMxpc, encodeMxpc } from "./mxpc";
import { assertKnownCodec, canSend, decodeMxpd, encodeMxpd, MXPD_FLAG } from "./mxpd";

function errorCode(result: { ok: true } | { ok: false; error: IpcError } | IpcError | null): string | undefined {
  if (!result) return undefined;
  if ("code" in result) return result.code;
  if (!result.ok) return result.error.code;
  return undefined;
}

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/plugin-contract");

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("plugin ipc v1 framing", () => {
  it("locks constants to contract freeze §13", () => {
    expect(constants.mxpc.magicAscii).toBe("MXPC");
    expect(constants.mxpd.magicAscii).toBe("MXPD");
    expect(MXPC_MAGIC).toBe(0x4d585043);
    expect(MXPD_MAGIC).toBe(0x4d585044);
    expect(MAX_PAYLOAD).toBe(1_048_576);
    expect(WINDOW_FRAMES).toBe(32);
    expect(WINDOW_BYTES).toBe(8_388_608);
    expect(constants.codecs).toEqual(["engine-event-v1", "blob-v1", "log-v1"]);
  });

  it("round-trips a handshake hello as MXPC", () => {
    const encoded = encodeMxpc(hello);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.bytes[0]).toBe(0x4d);
    expect(encoded.bytes[1]).toBe(0x58);
    expect(encoded.bytes[2]).toBe(0x50);
    expect(encoded.bytes[3]).toBe(0x43);
    const decoded = decodeMxpc(encoded.bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.message).toEqual(hello);
    expect(decoded.value.rest.length).toBe(0);
    expect(validateHandshakeHello(decoded.value.message).ok).toBe(true);
  });

  it("round-trips an MXPD data frame", () => {
    const encoded = encodeMxpd({
      flags: 0,
      streamId: 7,
      seq: 3,
      payload: new TextEncoder().encode("{\"type\":\"assistant\"}"),
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(toHex(encoded.bytes.subarray(0, 4))).toBe("4d585044");
    const decoded = decodeMxpd(encoded.bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.frame.streamId).toBe(7);
    expect(decoded.value.frame.seq).toBe(3);
    expect(new TextDecoder().decode(decoded.value.frame.payload)).toBe("{\"type\":\"assistant\"}");
  });

  it("rejects NDJSON, bad magic, reserved flags, and oversized frames", () => {
    expect(errorCode(decodeMxpc(new TextEncoder().encode('{"jsonrpc":"2.0"}\n')))).toBe("ndjson-forbidden");
    expect(errorCode(decodeMxpc(fromHex("deadbeef010000000001")))).toBe("bad-magic");

    const versioned = encodeMxpc(hello);
    expect(versioned.ok).toBe(true);
    if (!versioned.ok) return;
    versioned.bytes[4] = 2;
    expect(errorCode(decodeMxpc(versioned.bytes))).toBe("unsupported-version");

    const flagged = encodeMxpc(hello);
    expect(flagged.ok).toBe(true);
    if (!flagged.ok) return;
    flagged.bytes[5] = 1;
    expect(errorCode(decodeMxpc(flagged.bytes))).toBe("reserved-flag");

    const truncated = encodeMxpc(hello);
    expect(truncated.ok).toBe(true);
    if (!truncated.ok) return;
    expect(errorCode(decodeMxpc(truncated.bytes.subarray(0, 12)))).toBe("truncated");

    expect(assertKnownCodec("custom-pack")?.code).toBe("unknown-codec");
    expect(errorCode(encodeMxpd({ flags: 0x08, streamId: 1, seq: 1, payload: new Uint8Array() }))).toBe(
      "reserved-flag",
    );
  });

  it("rejects payload larger than 1 MiB without emitting a frame", () => {
    const huge = { jsonrpc: "2.0", id: 1, method: "x", params: { blob: "a".repeat(MAX_PAYLOAD) } };
    expect(errorCode(encodeMxpc(huge))).toBe("payload-too-large");
    expect(errorCode(encodeMxpd({ flags: 0, streamId: 1, seq: 1, payload: new Uint8Array(MAX_PAYLOAD + 1) }))).toBe(
      "payload-too-large",
    );
  });

  it("enforces the 32-frame / 8 MiB send window", () => {
    expect(canSend(32, 0, 1)?.code).toBe("window-exceeded");
    expect(canSend(0, WINDOW_BYTES, 1)?.code).toBe("window-exceeded");
    expect(canSend(31, 0, 16)).toBeNull();
    expect(MXPD_FLAG.END).toBe(1);
    expect(MXPD_FLAG.CANCEL).toBe(2);
    expect(MXPD_FLAG.ACK).toBe(4);
  });

  it("accepts matching handshake and rejects nonce/version drift", () => {
    expect(validateHandshakeHello(hello).ok).toBe(true);
    expect(validateHandshakeAck(ack, hello.params.nonce).ok).toBe(true);
    expect(
      errorCode(validateHandshakeAck({ ...ack, result: { ...ack.result, nonce: "bb".repeat(32) } }, hello.params.nonce)),
    ).toBe("handshake-rejected");
    expect(
      errorCode(validateHandshakeAck({ ...ack, result: { ...ack.result, protocolVersion: 2 } }, hello.params.nonce)),
    ).toBe("handshake-rejected");
  });

  it("does not import transport sockets", () => {
    const source = [
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "mxpc.ts"), "utf8"),
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "mxpd.ts"), "utf8"),
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "handshake.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/UnixListener|NamedPipe|listen\(|createServer|node:net|node:fs/);
    expect(fixtureDir.endsWith("packages/plugin-contract")).toBe(true);
  });
});
