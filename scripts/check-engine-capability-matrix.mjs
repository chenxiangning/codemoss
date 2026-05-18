#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SPEC_MATRIX_PATH = path.join(
  repoRoot,
  "openspec/changes/add-engine-capability-matrix-spec/specs/engine-capability-matrix/fixtures/matrix.json",
);
const TS_MATRIX_PATH = path.join(repoRoot, "src/features/engine/engineCapabilityMatrix.ts");
const RUST_MATRIX_PATH = path.join(repoRoot, "src-tauri/src/engine/capability_matrix.rs");

const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?$/;

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function normalizeMatrix(matrix) {
  return Object.fromEntries(
    Object.entries(matrix).map(([engine, capabilities]) => [
      engine,
      Object.fromEntries(Object.entries(capabilities).sort(([left], [right]) => left.localeCompare(right))),
    ]).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function extractTsMatrix(source) {
  const matrix = {};
  const rowPattern = /engine:\s*"([^"]+)",\s*capabilities:\s*\{([\s\S]*?)\},\s*\}/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(source))) {
    const engine = rowMatch[1];
    const body = rowMatch[2];
    matrix[engine] = {};
    const cellPattern = /"([^"]+)":\s*"([^"]+)"/g;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(body))) {
      matrix[engine][cellMatch[1]] = cellMatch[2];
    }
  }
  return matrix;
}

function extractRustCapabilityKeys(source) {
  const match = source.match(/ENGINE_CAPABILITY_KEYS:\s*\[&str;\s*\d+\]\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error("Rust ENGINE_CAPABILITY_KEYS constant was not found.");
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function extractRustMatrix(source, specEngines) {
  const matrix = {};
  for (const engine of specEngines) {
    matrix[engine] = {};
  }
  const featureBlockPattern = /pub fn (\w+)\(\) -> Self \{\s*Self \{([\s\S]*?)\n\s*\}\s*\}/g;
  const featureByEngine = {};
  let blockMatch;
  while ((blockMatch = featureBlockPattern.exec(source))) {
    const engine = blockMatch[1] === "opencode" ? "opencode" : blockMatch[1];
    featureByEngine[engine] = Object.fromEntries(
      [...blockMatch[2].matchAll(/(\w+):\s*(true|false)/g)].map((entry) => [
        entry[1],
        entry[2] === "true",
      ]),
    );
  }
  for (const engine of specEngines) {
    const features = featureByEngine[engine];
    if (!features) {
      throw new Error(`Rust EngineFeatures::${engine}() was not found.`);
    }
    const streamingState = features.streaming ? "supported" : "unsupported";
    matrix[engine] = {
      "streaming.text": streamingState,
      "streaming.reasoning": streamingState,
      "streaming.tool-output": streamingState,
      "tool.use": features.tools_control ? "supported" : "unsupported",
      "tool.mcp": features.mcp ? "supported" : "unsupported",
      "reasoning.effort": features.reasoning_effort ? "supported" : "unsupported",
      "collaboration.mode": features.collaboration_mode ? "supported" : "unsupported",
      "session.continuation": features.session_resume ? "supported" : "unsupported",
      "image.input": features.image_input ? "supported" : "unsupported",
    };
  }
  return matrix;
}

function diffMatrices(label, expected, actual) {
  const diffs = [];
  for (const engine of Object.keys(expected)) {
    if (!actual[engine]) {
      diffs.push(`${label}: missing engine ${engine}`);
      continue;
    }
    for (const capability of Object.keys(expected[engine])) {
      if (actual[engine][capability] !== expected[engine][capability]) {
        diffs.push(
          `${label}: ${engine}.${capability} expected=${expected[engine][capability]} actual=${actual[engine][capability] ?? "<missing>"}`,
        );
      }
    }
  }
  for (const engine of Object.keys(actual)) {
    if (!expected[engine]) {
      diffs.push(`${label}: unexpected engine ${engine}`);
    }
  }
  return diffs;
}

function validateFixture(fixture) {
  const errors = [];
  const stateValues = new Set(fixture.stateValues ?? []);
  const domains = new Set(fixture.domains ?? []);
  for (const state of ["supported", "compat-input", "unsupported", "unknown"]) {
    if (!stateValues.has(state)) {
      errors.push(`fixture missing state value ${state}`);
    }
  }
  const capabilityKeys = fixture.capabilities.map((capability) => capability.key);
  for (const key of capabilityKeys) {
    if (!CAPABILITY_KEY_PATTERN.test(key)) {
      errors.push(`invalid capability key ${key}`);
      continue;
    }
    const domain = key.split(".")[0];
    if (!domains.has(domain)) {
      errors.push(`capability key ${key} uses undeclared domain ${domain}`);
    }
  }
  for (const engine of fixture.engines) {
    const row = fixture.matrix[engine];
    if (!row) {
      errors.push(`fixture missing matrix row ${engine}`);
      continue;
    }
    for (const key of capabilityKeys) {
      if (!stateValues.has(row[key])) {
        errors.push(`${engine}.${key} has invalid state ${row[key] ?? "<missing>"}`);
      }
    }
  }
  return errors;
}

function main() {
  const fixture = readJson(SPEC_MATRIX_PATH);
  const specMatrix = normalizeMatrix(fixture.matrix);
  const tsMatrix = normalizeMatrix(extractTsMatrix(readText(TS_MATRIX_PATH)));
  const engineModSource = readText(path.join(repoRoot, "src-tauri/src/engine/mod.rs"));
  const rustMatrixSource = readText(RUST_MATRIX_PATH);
  const rustMatrix = normalizeMatrix(extractRustMatrix(engineModSource, fixture.engines));
  const specCapabilityKeys = fixture.capabilities.map((capability) => capability.key);
  const rustCapabilityKeys = extractRustCapabilityKeys(rustMatrixSource);

  const errors = [
    ...validateFixture(fixture),
    ...diffMatrices("typescript", specMatrix, tsMatrix),
    ...diffMatrices("rust", specMatrix, rustMatrix),
  ];

  if (JSON.stringify(specCapabilityKeys) !== JSON.stringify(rustCapabilityKeys)) {
    errors.push(
      `rust capability keys differ from fixture: expected=${JSON.stringify(specCapabilityKeys)} actual=${JSON.stringify(rustCapabilityKeys)}`,
    );
  }

  if (errors.length > 0) {
    console.error("[engine-capability-matrix] mismatch detected:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("[engine-capability-matrix] OK");
}

main();
