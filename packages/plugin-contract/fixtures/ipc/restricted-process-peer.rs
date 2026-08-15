//! Standalone Restricted Process peer fixture. Compiled by tests with rustc.
//! Not a crate module. Not registered in command_registry.

use std::io::{Read, Write};
use std::time::Duration;

const MXPC_MAGIC: u32 = 0x4D58_5043;

fn main() {
    if std::env::var_os("MOSSX_SHOULD_NOT_INHERIT").is_some() {
        std::process::exit(2);
    }
    #[cfg(unix)]
    {
        extern "C" {
            fn fcntl(fd: i32, cmd: i32, ...) -> i32;
        }
        const F_GETFD: i32 = 1;
        for fd in 3..=256 {
            if unsafe { fcntl(fd, F_GETFD) } != -1 {
                std::process::exit(5);
            }
        }
    }
    let expected_cwd = std::env::var_os("MOSSX_PLUGIN_DATA");
    let actual_cwd = std::env::current_dir().ok();
    match (expected_cwd, actual_cwd) {
        (Some(expected), Some(actual)) if expected == actual => {}
        _ => std::process::exit(4),
    }
    let nonce = std::env::var("MOSSX_HANDSHAKE_NONCE").unwrap_or_default();
    let plugin_id = std::env::var("MOSSX_PLUGIN_ID").unwrap_or_else(|_| "com.mossx.notes".into());
    let generation = std::env::var("MOSSX_GENERATION").unwrap_or_else(|_| "1".into());
    let corrupt = std::env::var("MOSSX_CORRUPT_ACK").ok().as_deref() == Some("1");

    let mut header = [0_u8; 10];
    std::io::stdin().read_exact(&mut header).expect("header");
    let payload_len = u32::from_le_bytes([header[6], header[7], header[8], header[9]]) as usize;
    let mut payload = vec![0_u8; payload_len];
    std::io::stdin().read_exact(&mut payload).expect("payload");

    let ack_nonce = if corrupt {
        "b".repeat(64)
    } else {
        nonce
    };
    let body = format!(
        "{{\"jsonrpc\":\"2.0\",\"id\":\"hs-1\",\"result\":{{\"protocolVersion\":1,\"pluginId\":\"{plugin_id}\",\"version\":\"1.0.0\",\"generation\":{generation},\"nonce\":\"{ack_nonce}\"}}}}"
    );
    let mut frame = vec![0_u8; 10 + body.len()];
    frame[0..4].copy_from_slice(&MXPC_MAGIC.to_be_bytes());
    frame[4] = 1;
    frame[5] = 0;
    frame[6..10].copy_from_slice(&(body.len() as u32).to_le_bytes());
    frame[10..].copy_from_slice(body.as_bytes());
    let mut stdout = std::io::stdout();
    stdout.write_all(&frame).expect("ack");
    stdout.flush().expect("flush");

    loop {
        std::thread::sleep(Duration::from_secs(30));
    }
}
