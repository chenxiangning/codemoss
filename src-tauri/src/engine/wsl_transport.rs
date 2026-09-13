//! WSL 远程 spawn 通道 —— 把本机构造的引擎命令包装成 `ssh → wsl.exe` 执行。
//!
//! 工作区行带 `meta.wsl`(插件 `workspaces.add` 写入,见 plugin-sdk 0.3.3)时,
//! `send_message` 经此模块把引擎进程放到远程 Windows 宿主的发行版内:
//!
//! 1. 本地把 `exec <cli> <args…>` 脚本写入临时文件;
//! 2. 一次 `ssh <host> "wsl.exe -d <distro> -- tee /tmp/ccgui-wsl-<id>.sh"`
//!    把脚本送进发行版(远端串只含安全字符:无 `$`/`|`/`>`/反引号,宿主
//!    DefaultShell 无论 cmd.exe/PowerShell 都不会拆坏 —— b64 载荷走 stdin,
//!    `tee` 落盘);
//! 3. 真正的 run 进程 = `ssh <host> "wsl.exe -d <distro> -- bash /tmp/….sh"`,
//!    脚本以 `exec` 开头(bash 被替换为 CLI):stdin(prompt payload)与
//!    stdout(NDJSON 流)原样直通本管道,进程组 kill → ssh 断 → 远端
//!    SIGHUP 直达 CLI,中断语义与本地一致。
//!
//! 认证:key 直连(BatchMode),或插件预先建立的 SSH ControlMaster
//! (`controlPath` 随 meta 传入,本地 ssh 复用既有主连接,免密码交互)。
//! 远端脚本落盘残留 harmless(只含命令行,prompt 走 stdin 不落盘)。

use std::path::{Path, PathBuf};
use std::process::Stdio;

use tokio::process::Command;

/// `meta.wsl` 的形状(插件 ccgui-plugin-wsl 写入;其他插件可同构复用)。
#[derive(Debug, Clone)]
pub struct WslTransport {
    /// Windows 宿主地址(IP/主机名)。
    pub host: String,
    pub port: u16,
    pub user: String,
    /// 发行版名(wsl.exe -d)。
    pub distro: String,
    /// SSH ControlMaster 套接字路径;None = 纯 BatchMode(key 认证)。
    pub control_path: Option<String>,
}

/// 从工作区 `meta` JSON 提取传输描述;形状不符 = None(按本地工作区跑)。
pub fn from_workspace_meta(meta: &serde_json::Value) -> Option<WslTransport> {
    let wsl = meta.get("wsl")?;
    let host = wsl.get("host")?.as_str()?.trim().to_string();
    if host.is_empty() {
        return None;
    }
    let user = wsl.get("user")?.as_str()?.trim().to_string();
    if user.is_empty() {
        return None;
    }
    let distro = wsl.get("distro")?.as_str()?.trim().to_string();
    if distro.is_empty() {
        return None;
    }
    Some(WslTransport {
        host,
        port: match wsl.get("port") {
            Some(v) => v.as_u64()?.try_into().ok()?,
            None => 22,
        },
        user,
        distro,
        control_path: wsl
            .get("controlPath")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.trim().is_empty()),
    })
}

/// 单个 argv 元素的 POSIX 单引号包裹(bash 脚本内)。
fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

/// 从 tokio Command 抽取 program + args(构造点都在本 crate 内,env 由远端
/// CLI 自己的配置文件提供;本地 env 不跨机传递)。
fn program_and_args(command: &Command) -> Result<(String, Vec<String>), String> {
    let std_cmd = command.as_std();
    let program = std_cmd
        .get_program()
        .to_string_lossy()
        .into_owned();
    let args = std_cmd
        .get_args()
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    Ok((program, args))
}

/// ssh 公共选项(key 认证 BatchMode;ControlMaster 存在则复用免密)。
fn ssh_options(transport: &WslTransport) -> Vec<String> {
    let mut opts = vec![
        "-o".to_string(),
        "StrictHostKeyChecking=accept-new".to_string(),
        "-o".to_string(),
        "ConnectTimeout=10".to_string(),
        "-p".to_string(),
        transport.port.to_string(),
    ];
    match &transport.control_path {
        // Master connection exists → no password prompt will occur; BatchMode
        // keeps a dead master from hanging the spawn waiting on input.
        Some(cp) => {
            opts.push("-o".to_string());
            opts.push(format!("ControlPath={cp}"));
            opts.push("-o".to_string());
            opts.push("BatchMode=yes".to_string());
        }
        None => {
            opts.push("-o".to_string());
            opts.push("BatchMode=yes".to_string());
        }
    }
    opts
}

fn ssh_target(transport: &WslTransport) -> String {
    format!("{}@{}", transport.user, transport.host)
}

fn wsl_command_string(transport: &WslTransport, remote_argv: &[&str]) -> String {
    let distro = transport.distro.replace('"', "");
    let joined = remote_argv
        .iter()
        .map(|a| {
            // Windows-side quoting for the string the remote DefaultShell will
            // hand to wsl.exe: double quotes, no $ / backtick / | inside (the
            // caller guarantees the safe charset).
            format!("\"{a}\"")
        })
        .collect::<Vec<_>>()
        .join(" ");
    format!("wsl.exe -d \"{distro}\" -- {joined}")
}

/// 把 `exec <program> <args…>` 脚本经 ssh+tee 写入发行版,返回脚本远端路径。
/// 任何失败都返回 Err(spawn 前失败,turn 直接报错,与本地行为一致)。
async fn upload_script(transport: &WslTransport, script_body: &str, remote_path: &str) -> Result<(), String> {
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD.encode(script_body.as_bytes());
    let mut command = Command::new("ssh");
    for opt in ssh_options(transport) {
        command.arg(opt);
    }
    command.arg(ssh_target(transport));
    command.arg(wsl_command_string(transport, &["tee", remote_path]));
    command.stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| format!("ssh 脚本上传失败: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin.write_all(b64.as_bytes()).await.ok();
        stdin.shutdown().await.ok();
        drop(stdin);
    }
    // tee writes the file and exits 0; a failed auth/connect surfaces here as
    // a clear error instead of a mysterious empty run.
    let status = child.wait().await.map_err(|e| format!("ssh 脚本上传等待失败: {e}"))?;
    if !status.success() {
        return Err("wsl 脚本上传失败(检查远程主机连接/认证)".to_string());
    }
    Ok(())
}

/// 包装结果:重造后的 ssh 命令 + 本地临时脚本路径(run 结束清理)。
pub struct Wrapped {
    pub command: Command,
    pub cleanup_files: Vec<PathBuf>,
    /// 标记本次 spawn 不应设置本地 current_dir(远程路径在本机不存在)。
    pub skip_local_cwd: bool,
}

/// 把 build_command 产出的引擎命令包装成远程 ssh 执行。失败返回 Err。
pub async fn wrap(command: Command, transport: &WslTransport) -> Result<Wrapped, String> {
    let (program, args) = program_and_args(&command)?;
    let mut script = String::from("exec ");
    script.push_str(&sh_quote(&program));
    for a in &args {
        script.push(' ');
        script.push_str(&sh_quote(a));
    }
    let script_id = uuid::Uuid::new_v4().simple().to_string();
    let remote_path = format!("/tmp/ccgui-wsl-{script_id}.sh");
    upload_script(transport, &script, &remote_path).await?;

    let local_tmp = std::env::temp_dir().join(format!("ccgui-wsl-{script_id}.b64"));
    // Marker so send_message can set a local temp cwd instead of the remote
    // workspace path (which does not exist on this machine).
    std::fs::write(&local_tmp, b"").map_err(|e| format!("临时文件写入失败: {e}"))?;

    let mut wrapped = Command::new("ssh");
    for opt in ssh_options(transport) {
        wrapped.arg(opt);
    }
    wrapped.arg(ssh_target(transport));
    wrapped.arg(wsl_command_string(transport, &["bash", &remote_path]));
    Ok(Wrapped {
        command: wrapped,
        cleanup_files: vec![local_tmp],
        skip_local_cwd: true,
    })
}

/// 供 send_message 判断工作区是否远程(直接读 db 行的 meta JSON)。
pub fn transport_from_meta_json(meta_json: Option<&str>) -> Option<WslTransport> {
    let raw = meta_json?;
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;
    from_workspace_meta(&value)
}

/// 供调用方在 workspace meta 表里查询(路径 → meta 文本)。
pub fn workspace_meta_json(db: &crate::db::Db, workspace_path: &str) -> Option<String> {
    let conn = db.0.lock();
    conn.query_row(
        "SELECT meta FROM workspaces WHERE path = ?1",
        [workspace_path],
        |r| r.get::<_, Option<String>>(0),
    )
    .ok()
    .flatten()
}

/// 供 send_message 把本地 cwd 指到一个必然存在的目录(远程工作区场景)。
pub fn fallback_cwd() -> &'static Path {
    Path::new(".")
}
