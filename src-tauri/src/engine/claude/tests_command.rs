use super::*;

fn test_workspace_path() -> PathBuf {
    std::env::temp_dir().join("ccgui-claude-test-workspace")
}

#[test]
fn build_command_uses_session_id_for_new_conversation_without_continue() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    params.continue_session = false;
    params.session_id = Some("11111111-1111-4111-8111-111111111111".to_string());

    let command = session.build_command(&params, false, true, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(args.windows(2).any(|window| {
        window[0] == "--session-id" && window[1] == "11111111-1111-4111-8111-111111111111"
    }));
    assert!(!args
        .iter()
        .any(|arg| arg == "--continue" || arg == "--resume"));
}

#[test]
fn build_command_uses_resume_when_continue_session_is_enabled() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    params.continue_session = true;
    params.session_id = Some("22222222-2222-4222-8222-222222222222".to_string());

    let command = session.build_command(&params, false, true, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(args.windows(2).any(|window| {
        window[0] == "--resume" && window[1] == "22222222-2222-4222-8222-222222222222"
    }));
    assert!(!args.iter().any(|arg| arg == "--session-id"));
}

#[test]
fn build_command_includes_hook_events_when_requested() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();

    let command = session.build_command(&params, false, true, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(args.iter().any(|arg| arg == "--include-hook-events"));
}

#[test]
fn build_command_marks_gui_launch_as_claude_non_interactive() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();

    let command = session.build_command(&params, false, true, None, None);

    assert!(command.as_std().get_envs().any(|(key, value)| {
        key == CLAUDE_NON_INTERACTIVE_ENV && value.is_some_and(|entry| entry == "1")
    }));
}

#[test]
fn build_command_injects_managed_provider_env_per_turn() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    let provider_env = BTreeMap::from([
        (
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            "managed-token".to_string(),
        ),
        (
            "ANTHROPIC_BASE_URL".to_string(),
            "https://managed.example.test".to_string(),
        ),
    ]);

    let command = session.build_command_with_provider_env(
        &params,
        false,
        true,
        None,
        None,
        Some(&provider_env),
        None,
    );
    let env = command
        .as_std()
        .get_envs()
        .filter_map(|(key, value)| {
            value.map(|value| {
                (
                    key.to_string_lossy().to_string(),
                    value.to_string_lossy().to_string(),
                )
            })
        })
        .collect::<HashMap<_, _>>();

    assert_eq!(
        env.get("ANTHROPIC_AUTH_TOKEN").map(String::as_str),
        Some("managed-token")
    );
    assert_eq!(
        env.get("ANTHROPIC_BASE_URL").map(String::as_str),
        Some("https://managed.example.test")
    );
}

#[test]
fn build_command_clears_parent_routing_env_before_provider_apply() {
    // 模拟父进程残留 Kimi 模型槽：managed provider 未声明该键时，
    // 子进程也不得继续看到旧值（env_remove + 仅写 provider 键）。
    std::env::set_var("ANTHROPIC_MODEL", "k3");
    std::env::set_var("ANTHROPIC_DEFAULT_FABLE_MODEL", "k3");

    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    let provider_env = BTreeMap::from([
        (
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            "deepseek-token".to_string(),
        ),
        (
            "ANTHROPIC_BASE_URL".to_string(),
            "https://api.deepseek.com/anthropic".to_string(),
        ),
        ("ANTHROPIC_MODEL".to_string(), "deepseek-v4-pro".to_string()),
    ]);

    let command = session.build_command_with_provider_env(
        &params,
        false,
        true,
        None,
        None,
        Some(&provider_env),
        None,
    );
    let env = command
        .as_std()
        .get_envs()
        .filter_map(|(key, value)| {
            value.map(|value| {
                (
                    key.to_string_lossy().to_string(),
                    value.to_string_lossy().to_string(),
                )
            })
        })
        .collect::<HashMap<_, _>>();

    assert_eq!(
        env.get("ANTHROPIC_MODEL").map(String::as_str),
        Some("deepseek-v4-pro")
    );
    // 未在 provider_env 中声明的 DEFAULT_FABLE 经 env_remove 后不应再是 k3。
    // std::process::Command 的 env_remove 在 get_envs 中表现为 key 缺失或 None。
    assert_ne!(
        env.get("ANTHROPIC_DEFAULT_FABLE_MODEL").map(String::as_str),
        Some("k3")
    );

    std::env::remove_var("ANTHROPIC_MODEL");
    std::env::remove_var("ANTHROPIC_DEFAULT_FABLE_MODEL");
}

#[test]
fn build_command_uses_private_provider_settings_without_exposing_secret_in_args() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    let provider_env = BTreeMap::from([
        (
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            "managed-secret-token".to_string(),
        ),
        (
            "ANTHROPIC_BASE_URL".to_string(),
            "https://managed.example.test".to_string(),
        ),
    ]);
    let settings_override = ClaudeProviderSettingsOverride::create(Some(&provider_env))
        .expect("create private provider settings")
        .expect("managed provider settings");

    let command = session.build_command_with_provider_env(
        &params,
        false,
        true,
        None,
        None,
        Some(&provider_env),
        Some(settings_override.path()),
    );
    let args = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect::<Vec<_>>();

    assert!(args.windows(2).any(|window| {
        window[0] == "--settings" && Path::new(&window[1]) == settings_override.path()
    }));
    assert!(!args.iter().any(|arg| arg.contains("managed-secret-token")));
}

#[test]
fn private_provider_settings_clear_inherited_routing_and_cleanup_on_drop() {
    let provider_env = BTreeMap::from([
        (
            "ANTHROPIC_API_KEY".to_string(),
            "provider-api-key".to_string(),
        ),
        (
            "ANTHROPIC_BASE_URL".to_string(),
            "https://provider.example.test".to_string(),
        ),
    ]);
    let settings_path = {
        let settings_override = ClaudeProviderSettingsOverride::create(Some(&provider_env))
            .expect("create private provider settings")
            .expect("managed provider settings");
        let settings_path = settings_override.path().to_path_buf();
        let settings: Value = serde_json::from_str(
            &fs::read_to_string(&settings_path).expect("read private provider settings"),
        )
        .expect("parse private provider settings");
        let env = settings
            .get("env")
            .and_then(Value::as_object)
            .expect("settings env object");

        assert_eq!(
            env.get("ANTHROPIC_API_KEY").and_then(Value::as_str),
            Some("provider-api-key")
        );
        assert_eq!(
            env.get("ANTHROPIC_AUTH_TOKEN").and_then(Value::as_str),
            Some("")
        );
        assert_eq!(env.get("ANTHROPIC_MODEL").and_then(Value::as_str), Some(""));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(settings_path.parent().expect("settings directory"))
                    .expect("settings directory metadata")
                    .permissions()
                    .mode()
                    & 0o777,
                0o700
            );
            assert_eq!(
                fs::metadata(&settings_path)
                    .expect("settings file metadata")
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        settings_path
    };

    assert!(!settings_path.exists());
}

#[test]
fn local_provider_does_not_create_settings_override() {
    assert!(ClaudeProviderSettingsOverride::create(None)
        .expect("local provider settings resolution")
        .is_none());
}

#[test]
fn build_command_keeps_parallel_provider_env_isolated() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();
    let provider_a = BTreeMap::from([(
        "ANTHROPIC_BASE_URL".to_string(),
        "https://provider-a.example.test".to_string(),
    )]);
    let provider_b = BTreeMap::from([(
        "ANTHROPIC_BASE_URL".to_string(),
        "https://provider-b.example.test".to_string(),
    )]);
    let settings_a = ClaudeProviderSettingsOverride::create(Some(&provider_a))
        .expect("create provider A settings")
        .expect("provider A settings");
    let settings_b = ClaudeProviderSettingsOverride::create(Some(&provider_b))
        .expect("create provider B settings")
        .expect("provider B settings");

    let command_a = session.build_command_with_provider_env(
        &params,
        false,
        true,
        None,
        None,
        Some(&provider_a),
        Some(settings_a.path()),
    );
    let command_b = session.build_command_with_provider_env(
        &params,
        false,
        true,
        None,
        None,
        Some(&provider_b),
        Some(settings_b.path()),
    );
    let base_url = |command: &Command| {
        command
            .as_std()
            .get_envs()
            .find(|(key, _)| *key == "ANTHROPIC_BASE_URL")
            .and_then(|(_, value)| value)
            .map(|value| value.to_string_lossy().to_string())
    };

    assert_eq!(
        base_url(&command_a).as_deref(),
        Some("https://provider-a.example.test")
    );
    assert_eq!(
        base_url(&command_b).as_deref(),
        Some("https://provider-b.example.test")
    );
    assert_ne!(settings_a.path(), settings_b.path());
    let settings_base_url = |path: &Path| {
        serde_json::from_str::<Value>(&fs::read_to_string(path).expect("read provider settings"))
            .expect("parse provider settings")
            .get("env")
            .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    assert_eq!(
        settings_base_url(settings_a.path()).as_deref(),
        Some("https://provider-a.example.test")
    );
    assert_eq!(
        settings_base_url(settings_b.path()).as_deref(),
        Some("https://provider-b.example.test")
    );
}

#[test]
fn build_command_can_omit_hook_events_for_legacy_retry() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "hello".to_string();

    let command = session.build_command(&params, false, false, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(!args.iter().any(|arg| arg == "--include-hook-events"));
}

#[test]
fn context_bootstrap_profile_disables_expensive_claude_customizations() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "MOSSX_CONTEXT_PACKAGE:package:checksum".to_string();
    params.custom_spec_root = Some("/tmp/external-spec".to_string());
    let activation_hint = Path::new("/tmp/activation-hint.md");

    let command = session.build_command_with_profile(
        &params,
        true,
        false,
        None,
        Some(activation_hint),
        None,
        None,
        ClaudeCommandProfile::ContextBootstrap,
    );
    let args = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect::<Vec<_>>();

    assert!(args.iter().any(|arg| arg == "--safe-mode"));
    assert!(args
        .windows(2)
        .any(|window| window[0] == "--tools" && window[1].is_empty()));
    assert!(args.iter().any(|arg| arg == "--disable-slash-commands"));
    assert!(args
        .windows(2)
        .any(|window| window[0] == "--prompt-suggestions" && window[1] == "false"));
    assert!(args.windows(2).any(|window| {
        window[0] == "--system-prompt" && window[1] == CLAUDE_CONTEXT_BOOTSTRAP_SYSTEM_PROMPT
    }));
    assert!(args.iter().any(|arg| arg == "--replay-user-messages"));
    for excluded in [
        "--append-system-prompt",
        "--append-system-prompt-file",
        "--mcp-config",
        "--include-hook-events",
        "--add-dir",
    ] {
        assert!(
            !args.iter().any(|arg| arg == excluded),
            "bootstrap command must omit {excluded}: {args:?}"
        );
    }
}

#[test]
fn detects_unknown_include_hook_events_errors_for_legacy_retry() {
    assert!(ClaudeSession::is_unknown_include_hook_events_error(
        "error: unknown option '--include-hook-events'",
    ));
    assert!(ClaudeSession::is_unknown_include_hook_events_error(
        "unrecognized option: --include-hook-events",
    ));
    assert!(!ClaudeSession::is_unknown_include_hook_events_error(
        "API Error: provider overloaded",
    ));
}

#[test]
fn build_command_uses_native_fork_session_contract() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "branch from parent".to_string();
    params.session_id = Some("child-should-not-be-used".to_string());
    params.fork_session_id = Some("33333333-3333-4333-8333-333333333333".to_string());

    let command = session.build_command(&params, false, true, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(args.windows(2).any(|window| {
        window[0] == "--resume" && window[1] == "33333333-3333-4333-8333-333333333333"
    }));
    assert!(args.iter().any(|arg| arg == "--fork-session"));
    assert!(!args
        .windows(2)
        .any(|window| { window[0] == "--session-id" && window[1] == "child-should-not-be-used" }));
}

#[test]
fn build_command_rejects_invalid_native_fork_session_ids() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    for invalid in [
        "",
        "   ",
        ".",
        "../secrets",
        "..\\secrets",
        "--continue",
        "abc\nresume",
        "parent:child",
        "parent.jsonl",
    ] {
        let mut params = SendMessageParams::default();
        params.text = "branch from parent".to_string();
        params.fork_session_id = Some(invalid.to_string());
        params.continue_session = true;
        params.session_id = Some("must-not-fallback".to_string());

        assert!(
            ClaudeSession::normalized_fork_session_id(&params).is_err(),
            "expected invalid fork session id to be rejected: {invalid:?}",
        );
        let command = session.build_command(&params, false, true, None, None);
        let args: Vec<String> = command
            .as_std()
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();
        assert!(
            !args.iter().any(|arg| arg == "--fork-session"),
            "invalid fork session id must not reach argv: {args:?}",
        );
        assert!(
            !args
                .windows(2)
                .any(|window| window[0] == "--resume" && window[1] == "must-not-fallback"),
            "invalid fork session id must not silently fall back to resume: {args:?}",
        );
        assert!(
            !args.iter().any(|arg| arg == "--continue"),
            "invalid fork session id must not silently fall back to continue: {args:?}",
        );
    }
}

#[test]
fn build_command_passes_custom_bracket_model_to_cli_argv() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut params = SendMessageParams::default();
    params.text = "1+1".to_string();
    params.model = Some("Cxn[1m]".to_string());

    let command = session.build_command(&params, false, true, None, None);
    let args: Vec<String> = command
        .as_std()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect();

    assert!(args
        .windows(2)
        .any(|window| { window[0] == "--model" && window[1] == "Cxn[1m]" }));
}

#[test]
fn build_command_appends_allowed_reasoning_efforts() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);

    for effort in ["low", "medium", "high", "xhigh", "max"] {
        let mut params = SendMessageParams::default();
        params.text = "1+1".to_string();
        params.effort = Some(effort.to_string());

        let command = session.build_command(&params, false, true, None, None);
        let args: Vec<String> = command
            .as_std()
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();

        assert!(
            args.windows(2)
                .any(|window| window[0] == "--effort" && window[1] == effort),
            "missing --effort {effort} in args: {args:?}"
        );
    }
}

#[test]
fn build_command_ignores_missing_empty_and_invalid_reasoning_effort() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);

    for effort in [None, Some(""), Some("   "), Some("ultra"), Some("--danger")] {
        let mut params = SendMessageParams::default();
        params.text = "1+1".to_string();
        params.effort = effort.map(str::to_string);

        let command = session.build_command(&params, false, true, None, None);
        let args: Vec<String> = command
            .as_std()
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();

        assert!(!args.iter().any(|arg| arg == "--effort"));
        assert!(!args.iter().any(|arg| arg == "--danger"));
        assert!(!args.iter().any(|arg| arg == "ultra"));
    }
}
