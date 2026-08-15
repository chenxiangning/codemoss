//! Injected-path Unix Domain Socket MXPC transport. No TCP, no spawn, not in boot.

use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use serde_json::Value;

use super::ipc::{decode_mxpc, encode_mxpc, IpcError, MXPC_HEADER_BYTES};

fn err(code: &'static str, message: impl Into<String>) -> IpcError {
    IpcError {
        code,
        message: message.into(),
    }
}

#[cfg(unix)]
fn io_err(error: std::io::Error) -> IpcError {
    err("transport", error.to_string())
}

pub fn read_mxpc_frame(reader: &mut impl Read) -> Result<Value, IpcError> {
    let mut header = [0_u8; MXPC_HEADER_BYTES];
    reader.read_exact(&mut header).map_err(|error| {
        if error.kind() == std::io::ErrorKind::UnexpectedEof {
            err("truncated", "incomplete MXPC header")
        } else {
            err("transport", error.to_string())
        }
    })?;
    let payload_len = u32::from_le_bytes([header[6], header[7], header[8], header[9]]) as usize;
    let mut frame = Vec::with_capacity(MXPC_HEADER_BYTES + payload_len);
    frame.extend_from_slice(&header);
    frame.resize(MXPC_HEADER_BYTES + payload_len, 0);
    reader
        .read_exact(&mut frame[MXPC_HEADER_BYTES..])
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::UnexpectedEof {
                err("truncated", "incomplete MXPC payload")
            } else {
                err("transport", error.to_string())
            }
        })?;
    let (value, _) = decode_mxpc(&frame)?;
    Ok(value)
}

#[cfg(unix)]
fn wait_readable(fd: i32, timeout: Duration) -> Result<(), IpcError> {
    let mut fds = [libc::pollfd {
        fd,
        events: libc::POLLIN,
        revents: 0,
    }];
    let ms = i32::try_from(timeout.as_millis()).unwrap_or(i32::MAX);
    let rc = unsafe { libc::poll(fds.as_mut_ptr(), 1, ms) };
    if rc == 0 {
        return Err(err(
            "handshake-timeout",
            "handshake ack must arrive within 2s",
        ));
    }
    if rc < 0 {
        return Err(err("transport", "poll failed while waiting for handshake"));
    }
    Ok(())
}

#[cfg(unix)]
pub fn read_mxpc_frame_timed(
    reader: &mut (impl Read + std::os::unix::io::AsRawFd),
    timeout: Duration,
) -> Result<Value, IpcError> {
    wait_readable(reader.as_raw_fd(), timeout)?;
    read_mxpc_frame(reader)
}

#[cfg(not(unix))]
pub fn read_mxpc_frame_timed(reader: &mut impl Read, timeout: Duration) -> Result<Value, IpcError> {
    let _ = timeout;
    read_mxpc_frame(reader)
}

pub fn write_mxpc_frame(writer: &mut impl Write, message: &Value) -> Result<(), IpcError> {
    let bytes = encode_mxpc(message)?;
    writer
        .write_all(&bytes)
        .map_err(|error| err("transport", error.to_string()))?;
    writer
        .flush()
        .map_err(|error| err("transport", error.to_string()))?;
    Ok(())
}

#[cfg(unix)]
fn parent_is_owner_only(path: &Path) -> Result<(), IpcError> {
    use std::os::unix::fs::PermissionsExt;

    let parent = path
        .parent()
        .filter(|dir| !dir.as_os_str().is_empty())
        .ok_or_else(|| err("schema", "uds path must have a parent directory"))?;
    if parent == Path::new("/tmp") || parent == Path::new("/var/tmp") {
        return Err(err(
            "permission-denied",
            "UDS cannot bind in a world-writable directory",
        ));
    }
    let mode = std::fs::metadata(parent).map_err(io_err)?.permissions().mode() & 0o777;
    if mode & 0o022 != 0 {
        return Err(err(
            "permission-denied",
            "UDS parent directory must be owner-only",
        ));
    }
    Ok(())
}

#[cfg(unix)]
pub fn private_uds_dir() -> Result<std::path::PathBuf, IpcError> {
    use std::os::unix::fs::PermissionsExt;

    let dir = Path::new("/tmp").join(format!("m{}", std::process::id() % 10_000));
    std::fs::create_dir_all(&dir).map_err(io_err)?;
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).map_err(io_err)?;
    Ok(dir)
}

#[cfg(unix)]
pub fn private_uds_path(tag: &str) -> Result<std::path::PathBuf, IpcError> {
    Ok(private_uds_dir()?.join(format!("{tag}.s")))
}

pub fn uds_peer_ok(peer_uid: u32) -> Result<(), IpcError> {
    #[cfg(unix)]
    {
        let current = unsafe { libc::getuid() };
        if peer_uid != current {
            return Err(err(
                "permission-denied",
                "UDS peer uid must be the current user",
            ));
        }
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = peer_uid;
        Err(err("unsupported-platform", "UDS transport is unix-only in V1"))
    }
}

#[cfg(unix)]
fn peer_uid_of(stream: &std::os::unix::net::UnixStream) -> Result<u32, IpcError> {
    use std::os::unix::io::AsRawFd;

    let fd = stream.as_raw_fd();
    #[cfg(any(target_os = "macos", target_os = "ios", target_os = "freebsd", target_os = "openbsd", target_os = "netbsd", target_os = "dragonfly"))]
    {
        let mut uid: libc::uid_t = 0;
        let mut gid: libc::gid_t = 0;
        let rc = unsafe { libc::getpeereid(fd, &mut uid, &mut gid) };
        if rc != 0 {
            return Err(err("permission-denied", "UDS peer credentials unavailable"));
        }
        Ok(uid)
    }
    #[cfg(target_os = "linux")]
    {
        let mut cred = libc::ucred {
            pid: 0,
            uid: 0,
            gid: 0,
        };
        let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
        let rc = unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_SOCKET,
                libc::SO_PEERCRED,
                &mut cred as *mut _ as *mut libc::c_void,
                &mut len,
            )
        };
        if rc != 0 {
            return Err(err("permission-denied", "UDS peer credentials unavailable"));
        }
        Ok(cred.uid)
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "freebsd",
        target_os = "openbsd",
        target_os = "netbsd",
        target_os = "dragonfly",
        target_os = "linux"
    )))]
    {
        let _ = fd;
        Err(err("unsupported-platform", "UDS peer credentials unavailable"))
    }
}

#[cfg(unix)]
pub fn accept_uds(
    listener: &std::os::unix::net::UnixListener,
) -> Result<std::os::unix::net::UnixStream, IpcError> {
    let (stream, _) = listener.accept().map_err(io_err)?;
    uds_peer_ok(peer_uid_of(&stream)?)?;
    Ok(stream)
}

#[cfg(unix)]
pub fn connect_uds(path: &Path) -> Result<std::os::unix::net::UnixStream, IpcError> {
    let stream = std::os::unix::net::UnixStream::connect(path).map_err(io_err)?;
    uds_peer_ok(peer_uid_of(&stream)?)?;
    Ok(stream)
}

#[cfg(not(unix))]
pub fn accept_uds(_listener: &()) -> Result<(), IpcError> {
    Err(err("unsupported-platform", "UDS transport is unix-only in V1"))
}

#[cfg(not(unix))]
pub fn connect_uds(_path: &Path) -> Result<(), IpcError> {
    Err(err("unsupported-platform", "UDS transport is unix-only in V1"))
}

#[cfg(unix)]
pub fn bind_uds(path: &Path) -> Result<std::os::unix::net::UnixListener, IpcError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(io_err)?;
        }
    }
    parent_is_owner_only(path)?;
    let _ = std::fs::remove_file(path);
    let listener = std::os::unix::net::UnixListener::bind(path).map_err(io_err)?;
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).map_err(io_err)?;
    Ok(listener)
}

#[cfg(not(unix))]
pub fn bind_uds(_path: &Path) -> Result<(), IpcError> {
    Err(err("unsupported-platform", "UDS transport is unix-only in V1"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

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

    #[cfg(unix)]
    fn temp_sock(tag: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        // sockaddr_un.sun_path is ~104 bytes; keep this under /tmp/m{pid}.
        private_uds_path(&format!(
            "{}{}",
            tag.chars().next().unwrap_or('x'),
            nanos % 1_000
        ))
        .expect("private dir")
    }

    #[cfg(unix)]
    #[test]
    fn hello_and_ack_round_trip_on_temp_uds() {
        use crate::plugin_runtime::ipc::{validate_handshake_ack, validate_handshake_hello};
        use std::thread;

        let path = temp_sock("roundtrip");
        let listener = bind_uds(&path).expect("bind");
        let server = thread::spawn({
            let path = path.clone();
            move || {
                let mut stream = accept_uds(&listener).expect("accept");
                let received = read_mxpc_frame(&mut stream).expect("server read hello");
                validate_handshake_hello(&received, 1).expect("hello");
                write_mxpc_frame(&mut stream, &ack(NONCE)).expect("server write ack");
                let _ = std::fs::remove_file(&path);
            }
        });
        let mut client = connect_uds(&path).expect("connect");
        write_mxpc_frame(&mut client, &hello()).expect("client hello");
        let received = read_mxpc_frame(&mut client).expect("client read ack");
        validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1).expect("ack");
        server.join().expect("server");
    }

    #[cfg(unix)]
    #[test]
    fn mismatched_nonce_is_rejected_after_uds_read() {
        use crate::plugin_runtime::ipc::validate_handshake_ack;
        use std::thread;

        let path = temp_sock("bad-nonce");
        let listener = bind_uds(&path).expect("bind");
        let server = thread::spawn({
            let path = path.clone();
            move || {
                let mut stream = accept_uds(&listener).expect("accept");
                let _ = read_mxpc_frame(&mut stream).expect("hello");
                write_mxpc_frame(&mut stream, &ack(&"bb".repeat(32))).expect("bad ack");
                let _ = std::fs::remove_file(&path);
            }
        });
        let mut client = connect_uds(&path).expect("connect");
        write_mxpc_frame(&mut client, &hello()).expect("hello");
        let received = read_mxpc_frame(&mut client).expect("ack frame");
        assert!(validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1).is_err());
        server.join().expect("server");
    }

    #[cfg(unix)]
    #[test]
    fn a_silent_peer_cannot_complete_handshake() {
        use std::thread;
        use std::time::Duration;

        let path = temp_sock("silent");
        let listener = bind_uds(&path).expect("bind");
        let server = thread::spawn({
            let path = path.clone();
            move || {
                let _stream = accept_uds(&listener).expect("accept");
                thread::sleep(Duration::from_millis(80));
                let _ = std::fs::remove_file(&path);
            }
        });
        let mut client = connect_uds(&path).expect("connect");
        write_mxpc_frame(&mut client, &hello()).expect("hello");
        assert_eq!(
            read_mxpc_frame_timed(&mut client, Duration::from_millis(20))
                .unwrap_err()
                .code,
            "handshake-timeout"
        );
        server.join().expect("server");
    }

    #[cfg(unix)]
    #[test]
    fn bound_uds_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;

        let path = temp_sock("mode");
        let _listener = bind_uds(&path).expect("bind");
        let mode = std::fs::metadata(&path)
            .expect("meta")
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(mode, 0o600);
        let parent_mode = std::fs::metadata(path.parent().expect("parent"))
            .expect("parent meta")
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(parent_mode, 0o700);
        let _ = std::fs::remove_file(&path);
    }

    #[cfg(unix)]
    #[test]
    fn a_socket_in_tmp_is_rejected() {
        assert_eq!(
            bind_uds(Path::new("/tmp/mx-open.s")).unwrap_err().code,
            "permission-denied"
        );
    }

    #[test]
    fn current_user_peer_is_accepted() {
        #[cfg(unix)]
        let uid = unsafe { libc::getuid() };
        #[cfg(not(unix))]
        let uid = 0;
        #[cfg(unix)]
        uds_peer_ok(uid).expect("current user");
        #[cfg(not(unix))]
        assert_eq!(uds_peer_ok(uid).unwrap_err().code, "unsupported-platform");
    }

    #[cfg(unix)]
    #[test]
    fn a_foreign_uid_cannot_complete_uds_handshake() {
        let foreign = unsafe { libc::getuid() }.wrapping_add(1);
        assert_eq!(uds_peer_ok(foreign).unwrap_err().code, "permission-denied");
    }

}
