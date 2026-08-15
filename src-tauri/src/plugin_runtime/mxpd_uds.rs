//! MXPD over injected UDS. Thread peer, no spawn, not in boot.

use std::sync::atomic::{AtomicU64, Ordering};

use super::mxpd::{read_mxpd_frame, DataPlane};
use super::uds::bind_uds;

static SOCK_SEQ: AtomicU64 = AtomicU64::new(1);

#[cfg(unix)]
fn sock_path() -> std::path::PathBuf {
    let seq = SOCK_SEQ.fetch_add(1, Ordering::Relaxed);
    super::uds::private_uds_path(&format!("d{}", seq % 1000))
        .unwrap_or_else(|_| std::path::PathBuf::from("/tmp/mx-open.s"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::ipc::MxpdFrame;
    use std::io::Read;

    fn blob(payload: &[u8]) -> MxpdFrame {
        MxpdFrame {
            flags: 0,
            stream_id: 11,
            seq: 1,
            payload: payload.to_vec(),
        }
    }

    #[cfg(unix)]
    #[test]
    fn blob_frame_round_trips_on_injected_uds() {
        use std::os::unix::net::UnixStream;
        use std::thread;

        let mut plane = DataPlane::default();
        plane
            .open("com.mossx.notes", 1, 11, "blob-v1")
            .expect("open");
        let path = sock_path();
        let listener = bind_uds(&path).expect("bind");
        let peer_path = path.clone();
        let peer = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let frame = read_mxpd_frame(&mut stream).expect("peer frame");
            let _ = std::fs::remove_file(&peer_path);
            frame
        });
        let mut client = UnixStream::connect(&path).expect("connect");
        plane
            .write_frame(&mut client, &blob(b"uds-blob"))
            .expect("write");
        let received = peer.join().expect("peer");
        assert_eq!(received.stream_id, 11);
        assert_eq!(received.payload, b"uds-blob");
    }

    #[cfg(unix)]
    #[test]
    fn revoked_generation_cannot_write_on_uds() {
        use std::os::unix::net::UnixStream;
        use std::thread;

        let mut plane = DataPlane::default();
        plane
            .open("com.mossx.notes", 1, 11, "blob-v1")
            .expect("open");
        let path = sock_path();
        let listener = bind_uds(&path).expect("bind");
        let peer_path = path.clone();
        let peer = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut leftover = Vec::new();
            stream.read_to_end(&mut leftover).expect("drain");
            let _ = std::fs::remove_file(&peer_path);
            leftover
        });
        let mut client = UnixStream::connect(&path).expect("connect");
        plane.revoke("com.mossx.notes", 1);
        let error = plane
            .write_frame(&mut client, &blob(b"stale"))
            .unwrap_err();
        assert_eq!(error.code, "not-open");
        drop(client);
        let leftover = peer.join().expect("peer");
        assert!(leftover.is_empty());
    }
}
