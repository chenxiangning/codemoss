//! MXPC/MXPD V1 codec. No sockets. Not registered in command_registry.

use serde_json::Value;

pub const MXPC_MAGIC: u32 = 0x4D58_5043;
pub const MXPD_MAGIC: u32 = 0x4D58_5044;
pub const IPC_VERSION: u8 = 1;
pub const MXPC_HEADER_BYTES: usize = 10;
pub const MXPD_HEADER_BYTES: usize = 18;
pub const MAX_PAYLOAD: usize = 1_048_576;
pub const WINDOW_FRAMES: u32 = 32;
pub const WINDOW_BYTES: u64 = 8_388_608;
pub const FLAG_END: u8 = 1;
pub const FLAG_CANCEL: u8 = 2;
pub const FLAG_ACK: u8 = 4;
pub const RESERVED_FLAG_MASK: u8 = 0b1111_1000;
pub const V1_CODECS: &[&str] = &["engine-event-v1", "blob-v1", "log-v1"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IpcError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> IpcError {
    IpcError {
        code,
        message: message.into(),
    }
}

fn read_u32be(bytes: &[u8], offset: usize) -> u32 {
    u32::from_be_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn write_u32be(out: &mut [u8], offset: usize, value: u32) {
    out[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
}

fn read_u32le(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn write_u32le(out: &mut [u8], offset: usize, value: u32) {
    out[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn looks_like_ndjson(bytes: &[u8]) -> bool {
    matches!(bytes.first(), Some(b'{') | Some(b'\n') | Some(b'\r'))
        || bytes.windows(2).any(|pair| pair == b"\n{")
}

pub fn encode_mxpc(message: &Value) -> Result<Vec<u8>, IpcError> {
    let payload = serde_json::to_vec(message).map_err(|_| err("invalid-json", "not JSON"))?;
    if payload.len() > MAX_PAYLOAD {
        return Err(err(
            "payload-too-large",
            format!("payload {} exceeds {MAX_PAYLOAD}", payload.len()),
        ));
    }
    let mut bytes = vec![0_u8; MXPC_HEADER_BYTES + payload.len()];
    write_u32be(&mut bytes, 0, MXPC_MAGIC);
    bytes[4] = IPC_VERSION;
    bytes[5] = 0;
    write_u32le(&mut bytes, 6, payload.len() as u32);
    bytes[MXPC_HEADER_BYTES..].copy_from_slice(&payload);
    Ok(bytes)
}

pub fn decode_mxpc(bytes: &[u8]) -> Result<(Value, usize), IpcError> {
    if bytes.is_empty() {
        return Err(err("need-more", "empty buffer"));
    }
    if bytes.len() < MXPC_HEADER_BYTES {
        if looks_like_ndjson(bytes) {
            return Err(err("ndjson-forbidden", "newline JSON is not MXPC"));
        }
        return Err(err("need-more", "incomplete MXPC header"));
    }
    let magic = read_u32be(bytes, 0);
    if magic != MXPC_MAGIC {
        if looks_like_ndjson(bytes) {
            return Err(err("ndjson-forbidden", "newline JSON is not MXPC"));
        }
        return Err(err("bad-magic", format!("expected MXPC, got {magic:#x}")));
    }
    if bytes[4] != IPC_VERSION {
        return Err(err(
            "unsupported-version",
            format!("version {} is not 1", bytes[4]),
        ));
    }
    if bytes[5] != 0 {
        return Err(err("reserved-flag", format!("MXPC flags must be 0, got {}", bytes[5])));
    }
    let payload_len = read_u32le(bytes, 6) as usize;
    if payload_len > MAX_PAYLOAD {
        return Err(err(
            "payload-too-large",
            format!("payload_len {payload_len} exceeds {MAX_PAYLOAD}"),
        ));
    }
    if bytes.len() < MXPC_HEADER_BYTES + payload_len {
        return Err(err("truncated", "control frame payload is incomplete"));
    }
    let payload = &bytes[MXPC_HEADER_BYTES..MXPC_HEADER_BYTES + payload_len];
    let value: Value =
        serde_json::from_slice(payload).map_err(|_| err("invalid-json", "MXPC payload is not JSON"))?;
    if !value.is_object() {
        return Err(err("invalid-json", "MXPC payload must be an object"));
    }
    Ok((value, MXPC_HEADER_BYTES + payload_len))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MxpdFrame {
    pub flags: u8,
    pub stream_id: u32,
    pub seq: u32,
    pub payload: Vec<u8>,
}

pub fn encode_mxpd(frame: &MxpdFrame) -> Result<Vec<u8>, IpcError> {
    if frame.flags & RESERVED_FLAG_MASK != 0 {
        return Err(err(
            "reserved-flag",
            format!("reserved MXPD flags set: {}", frame.flags),
        ));
    }
    if frame.payload.len() > MAX_PAYLOAD {
        return Err(err(
            "payload-too-large",
            format!("payload {} exceeds {MAX_PAYLOAD}", frame.payload.len()),
        ));
    }
    let mut bytes = vec![0_u8; MXPD_HEADER_BYTES + frame.payload.len()];
    write_u32be(&mut bytes, 0, MXPD_MAGIC);
    bytes[4] = IPC_VERSION;
    bytes[5] = frame.flags;
    write_u32le(&mut bytes, 6, frame.stream_id);
    write_u32le(&mut bytes, 10, frame.seq);
    write_u32le(&mut bytes, 14, frame.payload.len() as u32);
    bytes[MXPD_HEADER_BYTES..].copy_from_slice(&frame.payload);
    Ok(bytes)
}

pub fn decode_mxpd(bytes: &[u8]) -> Result<(MxpdFrame, usize), IpcError> {
    if bytes.len() < MXPD_HEADER_BYTES {
        return Err(err("need-more", "incomplete MXPD header"));
    }
    let magic = read_u32be(bytes, 0);
    if magic != MXPD_MAGIC {
        return Err(err("bad-magic", format!("expected MXPD, got {magic:#x}")));
    }
    if bytes[4] != IPC_VERSION {
        return Err(err(
            "unsupported-version",
            format!("version {} is not 1", bytes[4]),
        ));
    }
    if bytes[5] & RESERVED_FLAG_MASK != 0 {
        return Err(err(
            "reserved-flag",
            format!("reserved MXPD flags set: {}", bytes[5]),
        ));
    }
    let payload_len = read_u32le(bytes, 14) as usize;
    if payload_len > MAX_PAYLOAD {
        return Err(err(
            "payload-too-large",
            format!("payload_len {payload_len} exceeds {MAX_PAYLOAD}"),
        ));
    }
    if bytes.len() < MXPD_HEADER_BYTES + payload_len {
        return Err(err("truncated", "data frame payload is incomplete"));
    }
    Ok((
        MxpdFrame {
            flags: bytes[5],
            stream_id: read_u32le(bytes, 6),
            seq: read_u32le(bytes, 10),
            payload: bytes[MXPD_HEADER_BYTES..MXPD_HEADER_BYTES + payload_len].to_vec(),
        },
        MXPD_HEADER_BYTES + payload_len,
    ))
}

pub fn assert_known_codec(codec: &str) -> Result<(), IpcError> {
    if V1_CODECS.contains(&codec) {
        Ok(())
    } else {
        Err(err("unknown-codec", format!("codec {codec} is not a V1 codec")))
    }
}

pub fn can_send(unacked_frames: u32, unacked_bytes: u64, next_payload_bytes: u64) -> Result<(), IpcError> {
    if unacked_frames >= WINDOW_FRAMES || unacked_bytes + next_payload_bytes > WINDOW_BYTES {
        Err(err("window-exceeded", "unacked window is 32 frames or 8 MiB"))
    } else {
        Ok(())
    }
}

pub fn issue_handshake_nonce() -> String {
    format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple())
}

pub fn validate_handshake_hello(value: &Value, expected_generation: u64) -> Result<(), IpcError> {
    if value.get("jsonrpc").and_then(Value::as_str) != Some("2.0")
        || value.get("method").and_then(Value::as_str) != Some("mossx.handshake.hello")
    {
        return Err(err("handshake-rejected", "hello must be mossx.handshake.hello"));
    }
    let params = value
        .get("params")
        .and_then(Value::as_object)
        .ok_or_else(|| err("handshake-rejected", "hello params required"))?;
    if params.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
        return Err(err("handshake-rejected", "protocolVersion must be 1"));
    }
    let nonce = params
        .get("nonce")
        .and_then(Value::as_str)
        .ok_or_else(|| err("handshake-rejected", "nonce required"))?;
    if nonce.len() != 64 || !nonce.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(err("handshake-rejected", "nonce must be 32-byte hex"));
    }
    if expected_generation == 0 {
        return Err(err("handshake-rejected", "generation 0 is never a live handle"));
    }
    if params.get("generation").and_then(Value::as_u64) != Some(expected_generation) {
        return Err(err(
            "handshake-rejected",
            "hello generation must match the current generation",
        ));
    }
    Ok(())
}

pub fn validate_handshake_ack(
    value: &Value,
    expected_nonce: &str,
    expected_plugin_id: &str,
    expected_generation: u64,
) -> Result<(), IpcError> {
    let result = value
        .get("result")
        .and_then(Value::as_object)
        .ok_or_else(|| err("handshake-rejected", "ack must be a JSON-RPC result"))?;
    if result.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
        return Err(err("handshake-rejected", "ack protocolVersion must be 1"));
    }
    if result.get("nonce").and_then(Value::as_str) != Some(expected_nonce) {
        return Err(err("handshake-rejected", "ack must echo hello nonce"));
    }
    if expected_generation == 0 {
        return Err(err("handshake-rejected", "generation 0 is never a live handle"));
    }
    if !crate::plugin_runtime::manifest::plugin_id_ok(expected_plugin_id) {
        return Err(err("handshake-rejected", "pluginId must be reverse-DNS"));
    }
    if result.get("pluginId").and_then(Value::as_str) != Some(expected_plugin_id) {
        return Err(err("handshake-rejected", "ack pluginId must match the current plugin"));
    }
    if result.get("generation").and_then(Value::as_u64) != Some(expected_generation) {
        return Err(err(
            "handshake-rejected",
            "ack generation must match the current generation",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hello() -> Value {
        serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/ipc/valid/handshake-hello.json"
        ))
        .expect("hello")
    }

    fn ack() -> Value {
        serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/ipc/valid/handshake-ack.json"
        ))
        .expect("ack")
    }

    #[test]
    fn constants_match_contract() {
        assert_eq!(MXPC_MAGIC, 0x4D58_5043);
        assert_eq!(MXPD_MAGIC, 0x4D58_5044);
        assert_eq!(MAX_PAYLOAD, 1_048_576);
        assert_eq!(WINDOW_FRAMES, 32);
        assert_eq!(WINDOW_BYTES, 8_388_608);
        assert_eq!(FLAG_END | FLAG_CANCEL | FLAG_ACK, 7);
    }

    #[test]
    fn mxpc_round_trip_hello() {
        let encoded = encode_mxpc(&hello()).expect("encode");
        assert_eq!(&encoded[0..4], b"MXPC");
        let (decoded, used) = decode_mxpc(&encoded).expect("decode");
        assert_eq!(used, encoded.len());
        assert_eq!(decoded, hello());
        validate_handshake_hello(&decoded, 1).expect("hello shape");
    }

    #[test]
    fn mxpd_round_trip() {
        let frame = MxpdFrame {
            flags: 0,
            stream_id: 7,
            seq: 3,
            payload: b"{\"type\":\"assistant\"}".to_vec(),
        };
        let encoded = encode_mxpd(&frame).expect("encode");
        assert_eq!(&encoded[0..4], b"MXPD");
        let (decoded, _) = decode_mxpd(&encoded).expect("decode");
        assert_eq!(decoded, frame);
    }

    #[test]
    fn rejects_ndjson_and_bad_magic() {
        let ndjson = br#"{"jsonrpc":"2.0"}
"#;
        assert_eq!(decode_mxpc(ndjson).unwrap_err().code, "ndjson-forbidden");
        assert_eq!(
            decode_mxpc(&[0xde, 0xad, 0xbe, 0xef, 1, 0, 1, 0, 0, 0, 0]).unwrap_err().code,
            "bad-magic"
        );
    }

    #[test]
    fn rejects_unknown_codec_reserved_flag_and_window() {
        assert_eq!(assert_known_codec("custom-pack").unwrap_err().code, "unknown-codec");
        assert_eq!(
            encode_mxpd(&MxpdFrame {
                flags: 0x08,
                stream_id: 1,
                seq: 1,
                payload: Vec::new(),
            })
            .unwrap_err()
            .code,
            "reserved-flag"
        );
        assert_eq!(can_send(32, 0, 1).unwrap_err().code, "window-exceeded");
        assert_eq!(can_send(0, WINDOW_BYTES, 1).unwrap_err().code, "window-exceeded");
    }

    #[test]
    fn two_issued_nonces_are_distinct() {
        let first = issue_handshake_nonce();
        let second = issue_handshake_nonce();
        assert_eq!(first.len(), 64);
        assert_eq!(second.len(), 64);
        assert!(first.chars().all(|ch| ch.is_ascii_hexdigit()));
        assert!(second.chars().all(|ch| ch.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn handshake_rejects_nonce_drift() {
        validate_handshake_ack(&ack(), "aa".repeat(32).as_str(), "com.mossx.notes", 1).expect("ack");
        let mut bad = ack();
        bad["result"]["nonce"] = Value::String("bb".repeat(32));
        assert_eq!(
            validate_handshake_ack(&bad, "aa".repeat(32).as_str(), "com.mossx.notes", 1)
                .unwrap_err()
                .code,
            "handshake-rejected"
        );
    }

    #[test]
    fn a_notes_ack_cannot_satisfy_a_claude_handshake() {
        assert_eq!(
            validate_handshake_ack(
                &ack(),
                "aa".repeat(32).as_str(),
                "com.mossx.engine.claude",
                1
            )
            .unwrap_err()
            .code,
            "handshake-rejected"
        );
    }

    #[test]
    fn a_stale_generation_cannot_satisfy_the_current_handshake() {
        assert_eq!(
            validate_handshake_ack(&ack(), "aa".repeat(32).as_str(), "com.mossx.notes", 2)
                .unwrap_err()
                .code,
            "handshake-rejected"
        );
    }

    #[test]
    fn a_current_generation_hello_is_accepted() {
        validate_handshake_hello(&hello(), 1).expect("hello");
    }

    #[test]
    fn a_stale_hello_generation_cannot_start_handshake() {
        assert_eq!(
            validate_handshake_hello(&hello(), 2).unwrap_err().code,
            "handshake-rejected"
        );
        let mut zero = hello();
        zero["params"]["generation"] = Value::from(0);
        assert_eq!(
            validate_handshake_hello(&zero, 1).unwrap_err().code,
            "handshake-rejected"
        );
    }
}
