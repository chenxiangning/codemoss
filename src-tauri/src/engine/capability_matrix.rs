use std::collections::BTreeMap;

use super::{EngineFeatures, EngineType};

pub const CAPABILITY_SUPPORTED: &str = "supported";
pub const CAPABILITY_UNSUPPORTED: &str = "unsupported";

pub const ENGINE_CAPABILITY_KEYS: [&str; 9] = [
    "streaming.text",
    "streaming.reasoning",
    "streaming.tool-output",
    "tool.use",
    "tool.mcp",
    "reasoning.effort",
    "collaboration.mode",
    "session.continuation",
    "image.input",
];

pub fn engine_slug(engine: EngineType) -> &'static str {
    match engine {
        EngineType::Claude => "claude",
        EngineType::Codex => "codex",
        EngineType::Gemini => "gemini",
        EngineType::OpenCode => "opencode",
    }
}

pub fn project_engine_features_to_capabilities(
    features: &EngineFeatures,
) -> BTreeMap<&'static str, &'static str> {
    let streaming_state = if features.streaming {
        CAPABILITY_SUPPORTED
    } else {
        CAPABILITY_UNSUPPORTED
    };
    BTreeMap::from([
        ("streaming.text", streaming_state),
        (
            "streaming.reasoning",
            if features.streaming {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        ("streaming.tool-output", streaming_state),
        (
            "tool.use",
            if features.tools_control {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        (
            "tool.mcp",
            if features.mcp {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        (
            "reasoning.effort",
            if features.reasoning_effort {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        (
            "collaboration.mode",
            if features.collaboration_mode {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        (
            "session.continuation",
            if features.session_resume {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
        (
            "image.input",
            if features.image_input {
                CAPABILITY_SUPPORTED
            } else {
                CAPABILITY_UNSUPPORTED
            },
        ),
    ])
}

pub fn engine_capability_matrix() -> BTreeMap<&'static str, BTreeMap<&'static str, &'static str>> {
    BTreeMap::from([
        (
            engine_slug(EngineType::Claude),
            project_engine_features_to_capabilities(&EngineFeatures::claude()),
        ),
        (
            engine_slug(EngineType::Codex),
            project_engine_features_to_capabilities(&EngineFeatures::codex()),
        ),
        (
            engine_slug(EngineType::Gemini),
            project_engine_features_to_capabilities(&EngineFeatures::gemini()),
        ),
        (
            engine_slug(EngineType::OpenCode),
            project_engine_features_to_capabilities(&EngineFeatures::opencode()),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projects_engine_features_without_changing_legacy_shape() {
        let projected = project_engine_features_to_capabilities(&EngineFeatures {
            streaming: true,
            reasoning_effort: false,
            collaboration_mode: false,
            image_input: true,
            session_resume: true,
            tools_control: true,
            mcp: false,
        });

        assert_eq!(projected.get("streaming.text"), Some(&CAPABILITY_SUPPORTED));
        assert_eq!(
            projected.get("reasoning.effort"),
            Some(&CAPABILITY_UNSUPPORTED)
        );
        assert_eq!(projected.get("tool.mcp"), Some(&CAPABILITY_UNSUPPORTED));
        assert_eq!(projected.get("image.input"), Some(&CAPABILITY_SUPPORTED));
    }

    #[test]
    fn keeps_current_four_engine_matrix_explicit() {
        let matrix = engine_capability_matrix();

        assert_eq!(matrix.len(), 4);
        assert_eq!(
            matrix
                .get("codex")
                .and_then(|capabilities| capabilities.get("reasoning.effort")),
            Some(&CAPABILITY_SUPPORTED)
        );
        assert_eq!(
            matrix
                .get("opencode")
                .and_then(|capabilities| capabilities.get("tool.mcp")),
            Some(&CAPABILITY_UNSUPPORTED)
        );
        assert_eq!(
            matrix
                .get("opencode")
                .and_then(|capabilities| capabilities.get("image.input")),
            Some(&CAPABILITY_UNSUPPORTED)
        );
    }

    #[test]
    fn every_engine_row_has_every_capability_key() {
        let matrix = engine_capability_matrix();

        for capabilities in matrix.values() {
            assert_eq!(capabilities.len(), ENGINE_CAPABILITY_KEYS.len());
            for key in ENGINE_CAPABILITY_KEYS {
                assert!(capabilities.contains_key(key), "missing capability key {key}");
            }
        }
    }
}
