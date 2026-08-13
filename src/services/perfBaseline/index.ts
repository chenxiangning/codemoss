import type { MetricType } from "web-vitals";
import { appendRendererPerfDiagnostic } from "../rendererDiagnostics";
import {
  isPerfBaselineEnabled,
  PERF_BASELINE_SCHEMA_VERSION,
} from "./perfBaselineEnabled";
import { isPerfDiagnosticsFlagEnabled } from "./perfDiagnosticsFlag";

export {
  isPerfBaselineEnabled,
  PERF_BASELINE_SCHEMA_VERSION,
} from "./perfBaselineEnabled";
export const MAX_PERF_ENTRIES = 1000;
export const PERF_SAMPLE_RATE_PROFILER = 1;
export const WEB_VITALS_RATING_SCHEMA = "v3";

export type PerfProfilerSample = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

let webVitalsInstalled = false;
const profilerSamples: PerfProfilerSample[] = [];

export function reportWebVital(metric: MetricType) {
  if (!isPerfBaselineEnabled() && !isPerfDiagnosticsFlagEnabled()) {
    return;
  }
  appendRendererPerfDiagnostic("perf.web-vital", {
    schemaVersion: PERF_BASELINE_SCHEMA_VERSION,
    ratingSchema: WEB_VITALS_RATING_SCHEMA,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    id: metric.id,
    delta: metric.delta,
  });
}

export function reportProfilerSample(sample: PerfProfilerSample) {
  if (!isPerfBaselineEnabled()) {
    return;
  }
  profilerSamples.push(sample);
  if (profilerSamples.length > MAX_PERF_ENTRIES) {
    profilerSamples.splice(0, profilerSamples.length - MAX_PERF_ENTRIES);
  }
}

export function consumeProfilerSamples() {
  const samples = profilerSamples.splice(0, profilerSamples.length);
  return samples;
}

export async function installPerfBaselineWebVitals(force = false) {
  if (webVitalsInstalled) {
    return;
  }
  if (!force && !isPerfBaselineEnabled() && !isPerfDiagnosticsFlagEnabled()) {
    return;
  }
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }
  webVitalsInstalled = true;
  const { onCLS, onINP, onLCP } = await import("web-vitals");
  onCLS(reportWebVital);
  onINP(reportWebVital);
  onLCP(reportWebVital);
}

export function __resetPerfBaselineForTests() {
  webVitalsInstalled = false;
  profilerSamples.length = 0;
}
