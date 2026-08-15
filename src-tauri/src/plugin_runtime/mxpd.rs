//! In-process MXPD data plane over pipes. No spawn, not in boot.

use std::collections::HashMap;
use std::io::{Read, Write};

use super::ipc::{
    assert_known_codec, can_send, decode_mxpd, encode_mxpd, IpcError, MxpdFrame, FLAG_ACK,
    FLAG_CANCEL, MXPD_HEADER_BYTES,
};

pub const DEFAULT_STREAMS_PER_GENERATION: usize = 8;

fn err(code: &'static str, message: impl Into<String>) -> IpcError {
    IpcError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone)]
struct StreamState {
    plugin_id: String,
    generation: u64,
    codec: String,
    unacked_frames: u32,
    unacked_bytes: u64,
    cancelled: bool,
}

#[derive(Default)]
pub struct DataPlane {
    streams: HashMap<u32, StreamState>,
}

impl DataPlane {
    pub fn open(
        &mut self,
        plugin_id: &str,
        generation: u64,
        stream_id: u32,
        codec: &str,
    ) -> Result<(), IpcError> {
        assert_known_codec(codec)?;
        if self.streams.contains_key(&stream_id) {
            return Err(err("stream-exists", format!("stream {stream_id} already open")));
        }
        let open_for_generation = self
            .streams
            .values()
            .filter(|stream| stream.plugin_id == plugin_id && stream.generation == generation)
            .count();
        if open_for_generation >= DEFAULT_STREAMS_PER_GENERATION {
            return Err(err(
                "stream-budget",
                format!("generation {generation} already has {DEFAULT_STREAMS_PER_GENERATION} streams"),
            ));
        }
        self.streams.insert(
            stream_id,
            StreamState {
                plugin_id: plugin_id.to_string(),
                generation,
                codec: codec.to_string(),
                unacked_frames: 0,
                unacked_bytes: 0,
                cancelled: false,
            },
        );
        Ok(())
    }

    pub fn revoke(&mut self, plugin_id: &str, generation: u64) {
        self.streams.retain(|_, stream| {
            !(stream.plugin_id == plugin_id && stream.generation == generation)
        });
    }

    pub fn write_frame(
        &mut self,
        writer: &mut impl Write,
        frame: &MxpdFrame,
    ) -> Result<(), IpcError> {
        let stream = self
            .streams
            .get_mut(&frame.stream_id)
            .ok_or_else(|| err("not-open", format!("stream {} is not open", frame.stream_id)))?;
        if stream.cancelled && frame.flags & FLAG_ACK == 0 {
            return Err(err("cancelled", "non-ACK frames after CANCEL are dropped"));
        }
        if frame.flags & FLAG_CANCEL != 0 {
            stream.cancelled = true;
        }
        if frame.flags & FLAG_ACK == 0 {
            can_send(stream.unacked_frames, stream.unacked_bytes, frame.payload.len() as u64)?;
            stream.unacked_frames += 1;
            stream.unacked_bytes += frame.payload.len() as u64;
        }
        write_mxpd_frame(writer, frame)
    }

    pub fn ack(&mut self, stream_id: u32, payload_bytes: u64) -> Result<(), IpcError> {
        let stream = self
            .streams
            .get_mut(&stream_id)
            .ok_or_else(|| err("not-open", format!("stream {stream_id} is not open")))?;
        if stream.unacked_frames == 0 {
            return Err(err("stale-ack", "no unacked frames"));
        }
        stream.unacked_frames -= 1;
        stream.unacked_bytes = stream.unacked_bytes.saturating_sub(payload_bytes);
        Ok(())
    }

    pub fn codec(&self, stream_id: u32) -> Option<&str> {
        self.streams.get(&stream_id).map(|stream| stream.codec.as_str())
    }
}

pub fn write_mxpd_frame(writer: &mut impl Write, frame: &MxpdFrame) -> Result<(), IpcError> {
    let bytes = encode_mxpd(frame)?;
    writer
        .write_all(&bytes)
        .map_err(|error| err("transport", error.to_string()))?;
    writer
        .flush()
        .map_err(|error| err("transport", error.to_string()))?;
    Ok(())
}

pub fn read_mxpd_frame(reader: &mut impl Read) -> Result<MxpdFrame, IpcError> {
    let mut header = [0_u8; MXPD_HEADER_BYTES];
    reader.read_exact(&mut header).map_err(|error| {
        if error.kind() == std::io::ErrorKind::UnexpectedEof {
            err("truncated", "incomplete MXPD header")
        } else {
            err("transport", error.to_string())
        }
    })?;
    let payload_len = u32::from_le_bytes([header[14], header[15], header[16], header[17]]) as usize;
    let mut frame = Vec::with_capacity(MXPD_HEADER_BYTES + payload_len);
    frame.extend_from_slice(&header);
    frame.resize(MXPD_HEADER_BYTES + payload_len, 0);
    reader
        .read_exact(&mut frame[MXPD_HEADER_BYTES..])
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::UnexpectedEof {
                err("truncated", "incomplete MXPD payload")
            } else {
                err("transport", error.to_string())
            }
        })?;
    let (decoded, _) = decode_mxpd(&frame)?;
    Ok(decoded)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::thread;

    fn blob(seq: u32, payload: &[u8]) -> MxpdFrame {
        MxpdFrame {
            flags: 0,
            stream_id: 7,
            seq,
            payload: payload.to_vec(),
        }
    }

    #[test]
    fn send_without_open_is_rejected() {
        let mut plane = DataPlane::default();
        let (mut reader, mut writer) = std::io::pipe().expect("pipe");
        let error = plane
            .write_frame(&mut writer, &blob(1, b"nope"))
            .unwrap_err();
        assert_eq!(error.code, "not-open");
        drop(writer);
        let mut leftover = Vec::new();
        reader.read_to_end(&mut leftover).expect("drain");
        assert!(leftover.is_empty());
    }

    #[test]
    fn blob_frame_round_trips_on_a_pipe_after_open() {
        let mut plane = DataPlane::default();
        plane.open("com.mossx.notes", 1, 7, "blob-v1").expect("open");
        let (mut reader, mut writer) = std::io::pipe().expect("pipe");
        let peer = thread::spawn(move || read_mxpd_frame(&mut reader).expect("peer frame"));
        plane
            .write_frame(&mut writer, &blob(1, b"hello-blob"))
            .expect("write");
        drop(writer);
        let received = peer.join().expect("peer");
        assert_eq!(received.stream_id, 7);
        assert_eq!(received.payload, b"hello-blob");
        plane.ack(7, 10).expect("ack");
        assert_eq!(plane.codec(7), Some("blob-v1"));
    }

    #[test]
    fn cancel_drops_later_data_frames() {
        let mut plane = DataPlane::default();
        plane.open("com.mossx.notes", 1, 7, "blob-v1").expect("open");
        let (mut reader, mut writer) = std::io::pipe().expect("pipe");
        plane
            .write_frame(
                &mut writer,
                &MxpdFrame {
                    flags: FLAG_CANCEL,
                    stream_id: 7,
                    seq: 1,
                    payload: Vec::new(),
                },
            )
            .expect("cancel");
        let error = plane
            .write_frame(&mut writer, &blob(2, b"after-cancel"))
            .unwrap_err();
        assert_eq!(error.code, "cancelled");
        drop(writer);
        let first = read_mxpd_frame(&mut reader).expect("cancel frame");
        assert_eq!(first.flags, FLAG_CANCEL);
        let mut leftover = Vec::new();
        reader.read_to_end(&mut leftover).expect("drain");
        assert!(leftover.is_empty());
    }

    #[test]
    fn window_blocks_unacked_frames() {
        let mut plane = DataPlane::default();
        plane.open("com.mossx.notes", 1, 7, "log-v1").expect("open");
        let (mut reader, mut writer) = std::io::pipe().expect("pipe");
        for seq in 1..=32 {
            plane
                .write_frame(&mut writer, &blob(seq, b"x"))
                .expect("within window");
        }
        let error = plane.write_frame(&mut writer, &blob(33, b"x")).unwrap_err();
        assert_eq!(error.code, "window-exceeded");
        drop(writer);
        let mut leftover = Vec::new();
        reader.read_to_end(&mut leftover).expect("drain");
        assert!(!leftover.is_empty());
    }

    #[test]
    fn revoked_generation_cannot_write() {
        let mut plane = DataPlane::default();
        plane.open("com.mossx.notes", 1, 7, "blob-v1").expect("open");
        let (mut reader, mut writer) = std::io::pipe().expect("pipe");
        plane.revoke("com.mossx.notes", 1);
        let error = plane
            .write_frame(&mut writer, &blob(1, b"stale"))
            .unwrap_err();
        assert_eq!(error.code, "not-open");
        assert!(plane.codec(7).is_none());
        drop(writer);
        let mut leftover = Vec::new();
        reader.read_to_end(&mut leftover).expect("drain");
        assert!(leftover.is_empty());
    }
}
