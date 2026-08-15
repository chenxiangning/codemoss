//! In-process framed stdio MXPC. Pipes only; no OS child process.

use super::uds::{read_mxpc_frame, write_mxpc_frame};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::ipc::{validate_handshake_ack, validate_handshake_hello};
    use serde_json::{json, Value};
    use std::io::{PipeReader, PipeWriter};
    use std::thread;

    const NONCE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    fn hello() -> Value {
        json!({
            "jsonrpc": "2.0",
            "id": "hs-1",
            "method": "mossx.handshake.hello",
            "params": {
                "protocolVersion": 1,
                "coreContract": "1.0.0",
                "nonce": NONCE,
                "generation": 1
            }
        })
    }

    fn ack(nonce: &str) -> Value {
        json!({
            "jsonrpc": "2.0",
            "id": "hs-1",
            "result": {
                "protocolVersion": 1,
                "pluginId": "com.mossx.notes",
                "version": "1.0.0",
                "generation": 1,
                "nonce": nonce
            }
        })
    }

    fn duplex() -> ((PipeWriter, PipeReader), (PipeReader, PipeWriter)) {
        let (host_to_plugin_reader, host_to_plugin_writer) = std::io::pipe().expect("pipe");
        let (plugin_to_host_reader, plugin_to_host_writer) = std::io::pipe().expect("pipe");
        (
            (host_to_plugin_writer, plugin_to_host_reader),
            (host_to_plugin_reader, plugin_to_host_writer),
        )
    }

    #[test]
    fn hello_and_ack_round_trip_on_pipes() {
        let ((mut host_out, mut host_in), (mut peer_in, mut peer_out)) = duplex();
        let peer = thread::spawn(move || {
            let received = read_mxpc_frame(&mut peer_in).expect("peer hello");
            validate_handshake_hello(&received, 1).expect("hello");
            write_mxpc_frame(&mut peer_out, &ack(NONCE)).expect("peer ack");
        });
        write_mxpc_frame(&mut host_out, &hello()).expect("host hello");
        let received = read_mxpc_frame(&mut host_in).expect("host ack");
        validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1).expect("ack");
        peer.join().expect("peer");
    }

    #[test]
    fn mismatched_nonce_is_rejected_after_pipe_read() {
        let ((mut host_out, mut host_in), (mut peer_in, mut peer_out)) = duplex();
        let peer = thread::spawn(move || {
            let _ = read_mxpc_frame(&mut peer_in).expect("hello");
            write_mxpc_frame(&mut peer_out, &ack(&"bb".repeat(32))).expect("bad ack");
        });
        write_mxpc_frame(&mut host_out, &hello()).expect("hello");
        let received = read_mxpc_frame(&mut host_in).expect("ack frame");
        assert!(validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1).is_err());
        peer.join().expect("peer");
    }
}
