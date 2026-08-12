# add-pi-engine tasks

## 1. OpenSpec + capability

- [x] 1.1 proposal / design / tasks
- [x] 1.2 matrix fixture + ENGINE_VARIANTS + codegen
- [x] 1.3 adapter registry expectedBuiltins + model catalog

## 2. Rust runtime

- [x] 2.1 `pi.rs` spawn + NDJSON parse + interrupt
- [x] 2.2 `pi_history.rs` list/load/delete
- [x] 2.3 `pi_provider_profile.rs` local launch profile
- [x] 2.4 mod / manager / commands / status / events / adapter_registry
- [x] 2.5 session_history_commands + command_registry
- [x] 2.6 daemon engine_bridge modules + doctor

## 3. Lifecycle

- [x] 3.1 CliInstallEngine::Pi install/update/uninstall (npm `@earendil-works/pi-coding-agent`)
- [x] 3.2 pi_doctor
- [x] 3.3 AppSettings.pi_bin + frontend piBin

## 4. Frontend

- [x] 4.1 EngineType / ConversationEngine / adapters / loaders
- [x] 4.2 Composer / icons / cliEngineNav
- [x] 4.3 Settings path + validation tab shell + doctor API
- [x] 4.4 Streaming 白名单 / thread 前缀
- [x] 4.5 i18n enginePi / cliValidationTabPiCli

## 5. Verify

- [x] 5.1 engine-adapter-registry / capability-matrix / model-catalog gates
- [x] 5.2 unit tests pi/pi_history/pi_provider_profile (9 passed)
- [x] 5.3 cargo check --lib
