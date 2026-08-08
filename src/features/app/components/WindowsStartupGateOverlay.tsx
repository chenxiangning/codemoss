/**
 * @deprecated Prefer `./StartupGateOverlay`. Kept as a thin re-export so old
 * imports do not break mid-refactor.
 */
export {
  StartupGateOverlay,
  StartupGateOverlay as WindowsStartupGateOverlay,
  STARTUP_GATE_FORCE_DISMISS_MS,
  STARTUP_GATE_MIN_VISIBLE_MS,
  STARTUP_GATE_MAX_VISIBLE_MS,
  WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS,
  WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS,
  WINDOWS_STARTUP_GATE_MAX_VISIBLE_MS,
} from "./StartupGateOverlay";
