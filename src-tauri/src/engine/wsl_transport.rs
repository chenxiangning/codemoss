//! WSL 远程 spawn 通道 —— 把本机构造的引擎命令包装成 `ssh → wsl.exe` 执行。
//!
//! 工作区行带 `meta.wsl`(插件 `workspaces.add` 写入,见 plugin-sdk 0.3.3)时,
//! `send_message` 经此模块把引擎进程放到远程 Windows 宿主的发行版内:
//!
//! 1. 生成发行版内脚本:先 `cd` 到发行版内工作区,再以**发行版内**的引擎
//!    路径 `exec <cli> <args…>`(argv[0] 经 `enginePaths` 表或远端
//!    `command -v` 解析 —— 本机 macOS/Windows 路径在 Linux 里不存在);
//! 2. 一次 `ssh <host> "wsl.exe -d <distro> -- tee /tmp/ccgui-wsl-<id>.sh"`
//!    经 stdin 明文写入脚本(脚本内容不进命令串,零转义需求);
//! 3. 真正的 run 进程 = `ssh <host> "wsl.exe -d <distro> -- bash /tmp/….sh"`
//!    (命令串只含固定词,无 `$`/`|`/`>`/反引号,cmd/PowerShell 均惰性),
//!    脚本以 `exec` 开头(bash 被替换为 CLI):stdin(prompt payload)与
//!    stdout(NDJSON 流)原样直通本管道,进程组 kill → ssh 断 → 远端
//!    SIGHUP 直达 CLI,中断语义与本地一致。
//!
//! 认证:key 直连(BatchMode),或插件预先建立的 SSH ControlMaster
//! (`controlPath` 随 meta 传入,本地 ssh 复用既有主连接,免密码交互)。
//! 远端脚本落盘 harmless(只含命令行,prompt 走 stdin 不落盘)。

use std::collections::HashMap;
use std::path::PathBuf;
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
    /// 引擎 bin 在发行版内的绝对路径(bin 名 → 路径,插件探针写入)。
    pub engine_paths: HashMap<String, String>,
    /// 工作区在发行版内的路径(`cd` 目标;缺省 = 发行版默认 cwd)。
    pub workspace: Option<String>,
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
    let engine_paths = wsl
        .get("enginePaths")
        .and_then(|v| v.as_object())
        .map(|o| {
            o.iter()
                .filter_map(|(k, v)| {
                    let path = v.as_str()?.trim();
                    (!path.is_empty()).then(|| (k.clone(), path.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
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
        engine_paths,
        workspace: wsl
            .get("workspace")
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
    let program = std_cmd.get_program().to_string_lossy().into_owned();
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

/// 把本机 argv[0] 解析成发行版内的可执行路径:
/// 1. `enginePaths` 表命中(program 的 basename 或全等 program);
/// 2. 否则交给脚本内 `command -v` 兜底解析(远端 PATH 语义)。
fn resolve_remote_program(program: &str, transport: &WslTransport) -> String {
    let base = PathBuf::from(program)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| program.to_string());
    if let Some(p) = transport
        .engine_paths
        .get(program)
        .or_else(|| transport.engine_paths.get(&base))
    {
        return p.clone();
    }
    format!("__RESOLVE__{base}")
}

/// 生成发行版内执行的脚本文本。workspace 路径来自插件登记(插件侧白名单
/// `[A-Za-z0-9_./~-]` 校验),**不加引号**直排 —— bash 对行首 `~` 原生
/// tilde 展开(tmd 2026-09-13 真机验证形态;引号内 `~` 不展开,手动
/// `$HOME` 拼接是 Fragile 的)。
fn build_script(program: &str, args: &[String], transport: &WslTransport) -> String {
    let mut script = String::new();
    script.push_str("set -e\n");
    if let Some(ws) = &transport.workspace {
        if ws.is_empty()
            || ws.chars().any(|c| !(c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '.' | '-' | '~')))
        {
            return format!("echo 'workspace 路径含不支持的字符' >&2; exit 60\n");
        }
        script.push_str(&format!("cd {ws} || exit 61\n"));
    }
    let resolved = resolve_remote_program(program, transport);
    if let Some(base) = resolved.strip_prefix("__RESOLVE__") {
        // 登录 shell 解析(~/.profile 后的 PATH):非登录 `command -v`
        // 探不到 ~/.local/bin(tmd 2026-09-12 实测),引擎常装在那。
        script.push_str(&format!(
            "bin=$(bash -lc {}) || exit 62\n",
            sh_quote(&format!("command -v {base}"))
        ));
        script.push_str("exec \"$bin\"");
    } else {
        script.push_str("exec ");
        script.push_str(&sh_quote(&resolved));
    }
    for a in args {
        script.push(' ');
        script.push_str(&sh_quote(a));
    }
    script.push('\n');
    script
}

/// 把脚本经 ssh stdin 直写发行版 `tee`(脚本内容全程不进命令串,零转义
/// 需求;命令串只有固定词)。任何失败返回 Err(spawn 前失败,turn 直接报错)。
async fn upload_script(
    transport: &WslTransport,
    script_body: &str,
    remote_path: &str,
) -> Result<(), String> {
    let mut command = Command::new("ssh");
    for opt in ssh_options(transport) {
        command.arg(opt);
    }
    command.arg(ssh_target(transport));
    command.arg(wsl_command_string(transport, &["tee", remote_path]));
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|e| format!("ssh 脚本上传失败: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(script_body.as_bytes())
            .await
            .map_err(|e| format!("ssh 脚本写入失败: {e}"))?;
        stdin.shutdown().await.ok();
        drop(stdin);
    }
    let status = child
        .wait()
        .await
        .map_err(|e| format!("ssh 脚本上传等待失败: {e}"))?;
    if !status.success() {
        return Err("wsl 脚本上传失败(检查远程主机连接/认证;ControlMaster 可能已过期,请在 WSL 主机设置重新连接)".to_string());
    }
    Ok(())
}

/// 包装结果:重造后的 ssh 命令 + 本地临时标记文件(run 结束清理)。
pub struct Wrapped {
    pub command: Command,
    pub cleanup_files: Vec<PathBuf>,
    /// 标记本次 spawn 不应设置本地 current_dir(远程路径在本机不存在)。
    pub skip_local_cwd: bool,
}

/// 把 build_command 产出的引擎命令包装成远程 ssh 执行。失败返回 Err。
pub async fn wrap(command: Command, transport: &WslTransport) -> Result<Wrapped, String> {
    let (program, args) = program_and_args(&command)?;
    let script = build_script(&program, &args, transport);
    let script_id = uuid::Uuid::new_v4().simple().to_string();
    let remote_path = format!("/tmp/ccgui-wsl-{script_id}.sh");
    upload_script(transport, &script, &remote_path).await?;

    let local_tmp = std::env::temp_dir().join(format!("ccgui-wsl-{script_id}.marker"));
    std::fs::write(&local_tmp, b"").map_err(|e| format!("临时文件写入失败: {e}"))?;

    let mut wrapped = Command::new("ssh");
    for opt in ssh_options(transport) {
        wrapped.arg(opt);
    }
    wrapped.arg(ssh_target(transport));
    // 脚本已明文落盘,run 串只含固定词。
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
pub fn fallback_cwd() -> &'static std::path::Path {
    std::path::Path::new(".")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tp() -> WslTransport {
        WslTransport {
            host: "10.0.0.2".into(),
            port: 22,
            user: "dev".into(),
            distro: "Ubuntu-22.04".into(),
            control_path: None,
            engine_paths: HashMap::from([(
                "omp".to_string(),
                "/home/dev/.local/bin/omp".to_string(),
            )]),
            workspace: Some("/home/dev/proj".into()),
        }
    }

    #[test]
    fn meta_parses_engine_paths_and_workspace() {
        let meta = json!({"wsl": {
            "host": "10.0.0.2", "port": 2222, "user": "dev", "distro": "Ubuntu",
            "controlPath": "/tmp/m", "workspace": "/home/dev/p",
            "enginePaths": {"omp": "/home/dev/.local/bin/omp"}
        }});
        let t = from_workspace_meta(&meta).unwrap();
        assert_eq!(t.port, 2222);
        assert_eq!(t.control_path.as_deref(), Some("/tmp/m"));
        assert_eq!(
            t.engine_paths.get("omp").unwrap(),
            "/home/dev/.local/bin/omp"
        );
        assert_eq!(t.workspace.as_deref(), Some("/home/dev/p"));
    }

    #[test]
    fn script_maps_bin_cd_and_quotes_args() {
        let script = build_script(
            "/Users/x/.local/bin/omp",
            &["-p".into(), "hello world".into(), "--resume".into(), "s-1".into()],
            &tp(),
        );
        assert!(script.starts_with("set -e\n"));
        assert!(script.contains("cd /home/dev/proj || exit 61"));
        // argv[0] basename "omp" 命中 enginePaths → 发行版内路径
        assert!(script.contains("exec '/home/dev/.local/bin/omp'"));
        assert!(script.contains("'hello world'"));
        // 本机 mac 路径绝不残留
        assert!(!script.contains("/Users/"));
    }

    #[test]
    fn script_keeps_tilde_unquoted_for_native_expansion() {
        let mut t = tp();
        t.workspace = Some("~/code/proj".into());
        let script = build_script("omp", &[], &t);
        assert!(script.contains("cd ~/code/proj || exit 61"));
        // 引号包裹会杀死 bash 的 tilde 展开 —— 绝不能出现
        assert!(!script.contains("\"~/"));
    }

    #[test]
    fn script_rejects_space_paths() {
        let mut t = tp();
        t.workspace = Some("/home/dev/my proj".into());
        let script = build_script("omp", &[], &t);
        assert!(script.contains("exit 60"));
    }

    #[test]
    fn script_falls_back_to_command_v() {
        let script = build_script("kimi", &[], &tp());
        assert!(script.contains("bin=$(bash -lc 'command -v kimi') || exit 62"));
        assert!(script.contains("exec \"$bin\""));
    }

    #[test]
    fn remote_command_string_is_shell_inert() {
        let s = wsl_command_string(&tp(), &["bash", "/tmp/x.sh"]);
        assert_eq!(s, "wsl.exe -d \"Ubuntu-22.04\" -- \"bash\" \"/tmp/x.sh\"");
        assert!(!s.contains('$') && !s.contains('|') && !s.contains('`'));
    }
}
