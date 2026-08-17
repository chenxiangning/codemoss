//! Claude Process Entry peer. Host-owned MXPC supervisor, not the production Claude CLI.

use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

const MXPC_MAGIC: u32 = 0x4D58_5043;
const PROCESS_MEMORY_DEFAULT: u64 = 512 * 1024 * 1024;
const DENIED_STEMS: &[&str] = &[
    "sh", "bash", "zsh", "dash", "cmd", "powershell", "pwsh", "python", "python3", "node", "deno",
    "bun",
];

fn write_frame(stdout: &mut impl Write, body: &str) {
    let mut frame = vec![0_u8; 10 + body.len()];
    frame[0..4].copy_from_slice(&MXPC_MAGIC.to_be_bytes());
    frame[4] = 1;
    frame[5] = 0;
    frame[6..10].copy_from_slice(&(body.len() as u32).to_le_bytes());
    frame[10..].copy_from_slice(body.as_bytes());
    stdout.write_all(&frame).expect("write");
    stdout.flush().expect("flush");
}

fn read_payload() -> Option<String> {
    let mut header = [0_u8; 10];
    std::io::stdin().read_exact(&mut header).ok()?;
    let payload_len = u32::from_le_bytes([header[6], header[7], header[8], header[9]]) as usize;
    let mut payload = vec![0_u8; payload_len];
    std::io::stdin().read_exact(&mut payload).ok()?;
    String::from_utf8(payload).ok()
}

fn process_executable_ok(path: &Path) -> bool {
    if !path.is_absolute() || path.as_os_str().is_empty() {
        return false;
    }
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return false;
    }
    let Some(stem) = path.file_stem().and_then(|name| name.to_str()) else {
        return false;
    };
    !DENIED_STEMS
        .iter()
        .any(|denied| stem.eq_ignore_ascii_case(denied))
        && path.is_file()
}

fn json_string<'a>(source: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("\"{key}\":\"");
    let start = source.find(&needle)? + needle.len();
    let rest = &source[start..];
    let end = rest.find('"')?;
    Some(&rest[..end])
}

fn method_is(source: &str, method: &str) -> bool {
    json_string(source, "method") == Some(method)
}

fn json_array_strings(source: &str, key: &str) -> Vec<String> {
    let needle = format!("\"{key}\":[");
    let Some(start) = source.find(&needle) else {
        return Vec::new();
    };
    let rest = &source[start + needle.len()..];
    let Some(end) = rest.find(']') else {
        return Vec::new();
    };
    rest[..end]
        .split(',')
        .filter_map(|item| {
            let item = item.trim();
            item.strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'))
                .map(ToOwned::to_owned)
        })
        .collect()
}

fn hex_val(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn decode_hex(src: &str) -> Option<Vec<u8>> {
    if src.len() % 2 != 0 {
        return None;
    }
    let bytes = src.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 2);
    let mut index = 0;
    while index < bytes.len() {
        out.push((hex_val(bytes[index])? << 4) | hex_val(bytes[index + 1])?);
        index += 2;
    }
    Some(out)
}

fn encode_hex(data: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(data.len() * 2);
    for byte in data {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn cwd_ok(path: &Path) -> bool {
    path.is_absolute()
        && !path.as_os_str().is_empty()
        && !path
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
}

fn set_fd_nonblock(fd: i32) {
    #[cfg(unix)]
    {
        extern "C" {
            fn fcntl(fd: i32, cmd: i32, ...) -> i32;
        }
        const F_GETFL: i32 = 3;
        const F_SETFL: i32 = 4;
        #[cfg(target_os = "macos")]
        const O_NONBLOCK: i32 = 4;
        #[cfg(not(target_os = "macos"))]
        const O_NONBLOCK: i32 = 0o4000;
        unsafe {
            let flags = fcntl(fd, F_GETFL);
            if flags >= 0 {
                let _ = fcntl(fd, F_SETFL, flags | O_NONBLOCK);
            }
        }
    }
    let _ = fd;
}

fn set_pipe_nonblock(child: &Child) {
    #[cfg(unix)]
    {
        use std::os::unix::io::AsRawFd;
        if let Some(stdout) = child.stdout.as_ref() {
            set_fd_nonblock(stdout.as_raw_fd());
        }
        if let Some(stderr) = child.stderr.as_ref() {
            set_fd_nonblock(stderr.as_raw_fd());
        }
    }
    let _ = child;
}

fn supervise(executable: &str, argv: &[String], cwd: Option<&str>) -> Result<Child, &'static str> {
    let path = PathBuf::from(executable);
    if !process_executable_ok(&path) {
        return Err("denied");
    }
    let mut command = Command::new(&path);
    command
        .args(argv)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = cwd {
        let cwd = PathBuf::from(cwd);
        if !cwd_ok(&cwd) {
            return Err("denied");
        }
        command.current_dir(cwd);
    }
    let child = command.spawn().map_err(|_| "spawn")?;
    set_pipe_nonblock(&child);
    Ok(child)
}

fn write_error(id: &str, code: i32, message: &str) {
    write_frame(
        &mut std::io::stdout(),
        &format!(
            "{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"error\":{{\"code\":{code},\"message\":\"{message}\"}}}}"
        ),
    );
}

fn write_ok(id: &str) {
    write_frame(
        &mut std::io::stdout(),
        &format!("{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"result\":{{\"ok\":true}}}}"),
    );
}

fn request_id(payload: &str) -> String {
    json_string(payload, "id")
        .filter(|value| !value.is_empty())
        .unwrap_or("null")
        .to_string()
}

fn read_named_pipe(child: &mut Child, stderr: bool) -> (Vec<u8>, bool) {
    let mut buf = [0_u8; 4096];
    let result = if stderr {
        match child.stderr.as_mut() {
            Some(pipe) => pipe.read(&mut buf),
            None => return (Vec::new(), true),
        }
    } else {
        match child.stdout.as_mut() {
            Some(pipe) => pipe.read(&mut buf),
            None => return (Vec::new(), true),
        }
    };
    match result {
        Ok(0) => (Vec::new(), true),
        Ok(n) => (buf[..n].to_vec(), false),
        Err(error)
            if error.kind() == ErrorKind::WouldBlock || error.kind() == ErrorKind::Interrupted =>
        {
            let eof = child.try_wait().ok().flatten().is_some();
            (Vec::new(), eof)
        }
        Err(_) => (Vec::new(), true),
    }
}

fn write_bytes(id: &str, bytes: &[u8], eof: bool) {
    let eof = if eof { "true" } else { "false" };
    write_frame(
        &mut std::io::stdout(),
        &format!(
            "{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"result\":{{\"dataHex\":\"{}\",\"eof\":{eof}}}}}",
            encode_hex(bytes)
        ),
    );
}

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
        let declared = std::env::var("MOSSX_PROCESS_MEMORY")
            .ok()
            .and_then(|value| value.parse::<u64>().ok());
        if declared != Some(PROCESS_MEMORY_DEFAULT) {
            std::process::exit(6);
        }
        #[cfg(target_os = "linux")]
        {
            #[repr(C)]
            struct Rlimit {
                rlim_cur: u64,
                rlim_max: u64,
            }
            extern "C" {
                fn getrlimit(resource: i32, rlp: *mut Rlimit) -> i32;
            }
            const RLIMIT_AS: i32 = 9;
            let mut limit = Rlimit {
                rlim_cur: 0,
                rlim_max: 0,
            };
            if unsafe { getrlimit(RLIMIT_AS, &mut limit) } != 0
                || limit.rlim_cur == 0
                || limit.rlim_cur == u64::MAX
                || limit.rlim_cur == i64::MAX as u64
                || limit.rlim_cur > PROCESS_MEMORY_DEFAULT
            {
                std::process::exit(6);
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
    let plugin_id = std::env::var("MOSSX_PLUGIN_ID").unwrap_or_default();
    if plugin_id != "com.mossx.engine.claude" {
        std::process::exit(7);
    }
    let generation = std::env::var("MOSSX_GENERATION").unwrap_or_else(|_| "1".into());
    let corrupt = std::env::var("MOSSX_CORRUPT_ACK").ok().as_deref() == Some("1");

    let hello = read_payload().expect("hello");
    if !hello.contains("mossx.handshake.hello") {
        std::process::exit(8);
    }
    let ack_nonce = if corrupt {
        "b".repeat(64)
    } else {
        nonce
    };
    let ack = format!(
        "{{\"jsonrpc\":\"2.0\",\"id\":\"hs-1\",\"result\":{{\"protocolVersion\":1,\"pluginId\":\"{plugin_id}\",\"version\":\"1.0.0\",\"generation\":{generation},\"nonce\":\"{ack_nonce}\"}}}}"
    );
    write_frame(&mut std::io::stdout(), &ack);

    let mut supervised: Option<Child> = None;
    loop {
        let Some(payload) = read_payload() else {
            break;
        };
        if method_is(&payload, "mossx.process.supervise") {
            if let Some(mut child) = supervised.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            let id = request_id(&payload);
            let Some(executable) = json_string(&payload, "executable") else {
                write_error(&id, -32001, "schema");
                continue;
            };
            let argv = json_array_strings(&payload, "argv");
            let cwd = json_string(&payload, "cwd");
            match supervise(executable, &argv, cwd) {
                Ok(child) => {
                    let pid = child.id();
                    supervised = Some(child);
                    write_frame(
                        &mut std::io::stdout(),
                        &format!(
                            "{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"result\":{{\"ok\":true,\"pid\":{pid}}}}}"
                        ),
                    );
                }
                Err(_) => write_error(&id, -32002, "denied"),
            }
            continue;
        }
        if method_is(&payload, "mossx.process.stdio.write") {
            let id = request_id(&payload);
            let Some(child) = supervised.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            let Some(hex) = json_string(&payload, "dataHex") else {
                write_error(&id, -32001, "schema");
                continue;
            };
            let Some(bytes) = decode_hex(hex) else {
                write_error(&id, -32001, "schema");
                continue;
            };
            let Some(stdin) = child.stdin.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            if stdin.write_all(&bytes).is_err() || stdin.flush().is_err() {
                write_error(&id, -32002, "denied");
                continue;
            }
            write_ok(&id);
            continue;
        }
        if method_is(&payload, "mossx.process.stdio.read") {
            let id = request_id(&payload);
            let Some(child) = supervised.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            let (bytes, eof) = read_named_pipe(child, false);
            write_bytes(&id, &bytes, eof);
            continue;
        }
        if method_is(&payload, "mossx.process.stdio.read-stderr") {
            let id = request_id(&payload);
            let Some(child) = supervised.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            let (bytes, eof) = read_named_pipe(child, true);
            write_bytes(&id, &bytes, eof);
            continue;
        }
        if method_is(&payload, "mossx.process.stdio.close-stdin") {
            let id = request_id(&payload);
            let Some(child) = supervised.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            drop(child.stdin.take());
            write_ok(&id);
            continue;
        }
        if method_is(&payload, "mossx.process.wait") {
            let id = request_id(&payload);
            let Some(child) = supervised.as_mut() else {
                write_error(&id, -32002, "denied");
                continue;
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    let code = status.code().unwrap_or(-1);
                    write_frame(
                        &mut std::io::stdout(),
                        &format!(
                            "{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"result\":{{\"exited\":true,\"code\":{code}}}}}"
                        ),
                    );
                }
                Ok(None) => write_frame(
                    &mut std::io::stdout(),
                    &format!(
                        "{{\"jsonrpc\":\"2.0\",\"id\":\"{id}\",\"result\":{{\"exited\":false}}}}"
                    ),
                ),
                Err(_) => write_error(&id, -32002, "denied"),
            }
            continue;
        }
        write_frame(
            &mut std::io::stdout(),
            "{\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32601,\"message\":\"method-not-found\"}}",
        );
    }
    if let Some(mut child) = supervised.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    loop {
        std::thread::sleep(Duration::from_secs(30));
    }
}
