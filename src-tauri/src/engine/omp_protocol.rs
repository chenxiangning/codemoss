//! OMP-owned JSONL framing primitives for ACP and Native RPC.
//!
//! This module intentionally does not depend on PI protocol types or settlement
//! logic. Transport-specific clients can build on this bounded decoder.

use serde_json::Value;
use std::fmt;

use super::omp_release::OMP_METRICS;

pub const DEFAULT_MAX_FRAME_BYTES: usize = 1_048_576;

#[derive(Debug, PartialEq, Eq)]
pub enum OmpFrameError {
    InvalidUtf8,
    FrameTooLarge { limit: usize },
    InvalidJson { message: String },
}

impl fmt::Display for OmpFrameError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidUtf8 => formatter.write_str("OMP frame is not valid UTF-8"),
            Self::FrameTooLarge { limit } => write!(formatter, "OMP frame exceeds {limit} bytes"),
            Self::InvalidJson { message } => {
                write!(formatter, "OMP frame is not valid JSON: {message}")
            }
        }
    }
}

impl std::error::Error for OmpFrameError {}
#[derive(Debug)]
pub struct OmpFrameDecoder {
    buffer: Vec<u8>,
    pending_frames: Vec<Value>,
    max_frame_bytes: usize,
}

impl Default for OmpFrameDecoder {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_FRAME_BYTES)
    }
}

impl OmpFrameDecoder {
    pub fn new(max_frame_bytes: usize) -> Self {
        assert!(max_frame_bytes > 0, "OMP frame limit must be positive");
        Self {
            buffer: Vec::new(),
            pending_frames: Vec::new(),
            max_frame_bytes,
        }
    }

    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Value>, OmpFrameError> {
        self.buffer.extend_from_slice(bytes);
        if self.buffer.len() > self.max_frame_bytes.saturating_add(1)
            && !self.buffer.contains(&b'\n')
        {
            self.buffer.clear();
            OMP_METRICS.record_frame_rejected();
            return Err(OmpFrameError::FrameTooLarge {
                limit: self.max_frame_bytes,
            });
        }

        let mut decoded_frame_count = 0;
        while let Some(newline_index) = self.buffer.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = self.buffer.drain(..=newline_index).collect();
            let payload = line.strip_suffix(b"\n").unwrap_or(&line);
            let payload = payload.strip_suffix(b"\r").unwrap_or(payload);
            if payload.len() > self.max_frame_bytes {
                // FrameSize metric：超限帧拒绝可观测。
                OMP_METRICS.record_frame_rejected();
                return Err(OmpFrameError::FrameTooLarge {
                    limit: self.max_frame_bytes,
                });
            }
            if payload.is_empty() {
                continue;
            }
            let text = std::str::from_utf8(payload).map_err(|_| OmpFrameError::InvalidUtf8)?;
            let frame = serde_json::from_str(text).map_err(|error| OmpFrameError::InvalidJson {
                message: error.to_string(),
            })?;
            // FrameSize metric：每个成功解码帧记录字节数（纯 atomic，零分配）。
            OMP_METRICS.record_frame(payload.len());
            self.pending_frames.push(frame);
            decoded_frame_count += 1;
        }
        let split_crlf_separator = self.buffer.len() == self.max_frame_bytes.saturating_add(1)
            && self.buffer.last() == Some(&b'\r');
        if self.buffer.len() > self.max_frame_bytes && !split_crlf_separator {
            self.buffer.clear();
            OMP_METRICS.record_frame_rejected();
            return Err(OmpFrameError::FrameTooLarge {
                limit: self.max_frame_bytes,
            });
        }

        if decoded_frame_count == 0 {
            return Ok(Vec::new());
        }
        Ok(self.pending_frames.drain(..).collect())
    }

    pub fn take_pending_frames(&mut self) -> Vec<Value> {
        self.pending_frames.drain(..).collect()
    }
    pub fn buffered_bytes(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use super::{OmpFrameDecoder, OmpFrameError};
    use serde_json::json;

    #[test]
    fn decodes_multiple_jsonl_frames_and_partial_chunks() {
        let mut decoder = OmpFrameDecoder::new(128);
        assert_eq!(
            decoder.push(br#"{"type":"ready"}"#).unwrap(),
            Vec::<serde_json::Value>::new()
        );
        assert_eq!(
            decoder.push(b"\n{\"type\":\"response\"}\n").unwrap(),
            vec![json!({"type": "ready"}), json!({"type": "response"})]
        );
        assert_eq!(decoder.buffered_bytes(), 0);
    }

    #[test]
    fn ignores_empty_lines_and_crlf() {
        let mut decoder = OmpFrameDecoder::new(128);
        assert_eq!(
            decoder.push(b"\n\r\n{\"ok\":true}\r\n").unwrap(),
            vec![json!({"ok": true})]
        );
    }

    #[test]
    fn rejects_oversized_complete_frame() {
        let mut decoder = OmpFrameDecoder::new(8);
        let error = decoder.push(b"{\"long\":1}\n").unwrap_err();
        assert_eq!(error, OmpFrameError::FrameTooLarge { limit: 8 });
    }

    #[test]
    fn rejects_oversized_partial_frame_before_unbounded_buffering() {
        let mut decoder = OmpFrameDecoder::new(8);
        let error = decoder.push(b"123456789").unwrap_err();
        assert_eq!(error, OmpFrameError::FrameTooLarge { limit: 8 });
    }

    #[test]
    fn accepts_crlf_separator_split_after_max_sized_payload() {
        let mut decoder = OmpFrameDecoder::new(8);
        assert!(decoder.push(br#""123456""#).unwrap().is_empty());
        assert!(decoder.push(b"\r").unwrap().is_empty());
        assert_eq!(decoder.push(b"\n").unwrap(), vec![json!("123456")]);
    }

    #[test]
    fn preserves_valid_frames_before_malformed_frame_for_recovery() {
        let mut decoder = OmpFrameDecoder::new(128);
        let error = decoder.push(b"{\"ok\":1}\n{bad}\n").unwrap_err();
        assert!(matches!(error, OmpFrameError::InvalidJson { .. }));
        assert_eq!(decoder.take_pending_frames(), vec![json!({"ok": 1})]);
    }

    #[test]
    fn rejects_malformed_json_without_marking_success() {
        let mut decoder = OmpFrameDecoder::new(128);
        let error = decoder.push(b"{not-json}\n").unwrap_err();
        assert!(matches!(error, OmpFrameError::InvalidJson { .. }));
    }

    #[test]
    fn rejects_invalid_utf8() {
        let mut decoder = OmpFrameDecoder::new(128);
        assert_eq!(
            decoder.push(&[0xff, b'\n']).unwrap_err(),
            OmpFrameError::InvalidUtf8
        );
    }
    #[test]
    fn parses_acp_lifecycle_jsonl_messages_without_pi_assumptions() {
        let mut decoder = OmpFrameDecoder::default();
        let frames = decoder
            .push(
                b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}\n\
{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"session/new\"}\n\
{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"session/prompt\"}\n\
{\"jsonrpc\":\"2.0\",\"method\":\"session/update\"}\n\
{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"session/cancel\"}\n",
            )
            .unwrap();
        assert_eq!(frames.len(), 5);
        assert_eq!(frames[0]["method"], "initialize");
        assert_eq!(frames[1]["method"], "session/new");
        assert_eq!(frames[2]["method"], "session/prompt");
        assert_eq!(frames[3]["method"], "session/update");
        assert_eq!(frames[4]["method"], "session/cancel");
    }

    #[test]
    fn parses_native_rpc_ready_response_and_control_frames() {
        let mut decoder = OmpFrameDecoder::default();
        let frames = decoder
            .push(
                b"{\"type\":\"ready\",\"protocolVersion\":1,\"supportedProtocolVersions\":[1,2]}\n\
{\"type\":\"response\",\"id\":\"1\",\"command\":\"get_state\",\"success\":true}\n\
{\"type\":\"available_commands_update\"}\n\
{\"type\":\"extension_ui_request\"}\n",
            )
            .unwrap();
        assert_eq!(frames[0]["type"], "ready");
        assert_eq!(frames[1]["id"], "1");
        assert_eq!(frames[2]["type"], "available_commands_update");
        assert_eq!(frames[3]["type"], "extension_ui_request");
    }
}
