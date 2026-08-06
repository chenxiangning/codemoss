//! stages_from_bindings / apply_stage_bindings 单测

use crate::agent_orchestration::types::{
    apply_stage_bindings, default_stage_specs, stages_from_bindings, AgentStageBindingInput,
};
use crate::shared_event_log::canonical::types::CanonicalProviderProfileSource;
use crate::shared_session_v2::{EngineType, ExecutionTargetInput};

fn target(engine: EngineType) -> ExecutionTargetInput {
    ExecutionTargetInput {
        engine,
        provider_profile_id: None,
        model_catalog_entry_id: Some("m1".into()),
        model: Some("m1".into()),
        reasoning_effort: Some("medium".into()),
        provider_profile_name_snapshot: Some("local".into()),
        provider_profile_source: Some(CanonicalProviderProfileSource::Local),
        runtime_capability_fingerprint: None,
    }
}

#[test]
fn stages_from_bindings_preserves_n_stages_and_role_prompt() {
    let default = target(EngineType::Codex);
    let bindings = vec![
        AgentStageBindingInput {
            id: "plan".into(),
            target: target(EngineType::Claude),
            title: Some("规划".into()),
            role_prompt: Some("only plan".into()),
            access_mode: Some("read-only".into()),
            requires_approval: Some(true),
            persona_agent_id: Some("a1".into()),
            persona_agent_name: Some("小张".into()),
            persona_agent_icon: None,
        },
        AgentStageBindingInput {
            id: "implement".into(),
            target: target(EngineType::Codex),
            title: Some("实现".into()),
            role_prompt: None,
            access_mode: Some("current".into()),
            requires_approval: Some(false),
            persona_agent_id: None,
            persona_agent_name: None,
            persona_agent_icon: None,
        },
        AgentStageBindingInput {
            id: "test-harden".into(),
            target: target(EngineType::Claude),
            title: Some("测试加固".into()),
            role_prompt: Some("add tests".into()),
            access_mode: Some("current".into()),
            requires_approval: Some(false),
            persona_agent_id: None,
            persona_agent_name: None,
            persona_agent_icon: None,
        },
        AgentStageBindingInput {
            id: "review".into(),
            target: target(EngineType::Grok),
            title: Some("审查".into()),
            role_prompt: None,
            access_mode: Some("read-only".into()),
            requires_approval: Some(false),
            persona_agent_id: None,
            persona_agent_name: None,
            persona_agent_icon: None,
        },
    ];
    let stages = stages_from_bindings(&default, &bindings);
    assert_eq!(stages.len(), 4);
    assert_eq!(stages[0].id, "plan");
    assert_eq!(stages[0].role_prompt.as_deref(), Some("only plan"));
    assert_eq!(stages[0].persona_agent_name.as_deref(), Some("小张"));
    assert!(stages[0].requires_approval);
    assert_eq!(stages[2].id, "test-harden");
    assert_eq!(stages[2].title, "测试加固");
    assert!(!stages[2].requires_approval);
}

#[test]
fn apply_stage_bindings_rebuilds_when_rich_metadata_present() {
    let default = target(EngineType::Codex);
    let base = default_stage_specs(&default);
    assert_eq!(base.len(), 3);
    let bindings = vec![
        AgentStageBindingInput {
            id: "a".into(),
            target: target(EngineType::Claude),
            title: Some("A".into()),
            role_prompt: Some("ra".into()),
            access_mode: None,
            requires_approval: Some(false),
            persona_agent_id: None,
            persona_agent_name: None,
            persona_agent_icon: None,
        },
        AgentStageBindingInput {
            id: "b".into(),
            target: target(EngineType::Codex),
            title: Some("B".into()),
            role_prompt: None,
            access_mode: None,
            requires_approval: Some(false),
            persona_agent_id: None,
            persona_agent_name: None,
            persona_agent_icon: None,
        },
    ];
    let stages = apply_stage_bindings(base, &bindings);
    assert_eq!(stages.len(), 2);
    assert_eq!(stages[0].title, "A");
}
