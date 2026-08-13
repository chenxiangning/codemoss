# Model Structured Output Contract（模型结构化输出规范）

本规范适用于前端/服务层中任何从 AI model response 中提取 JSON、structured payload、candidate patch、action plan 或 schema-like object 的代码。

核心原则：model response 是不可信文本流，不是 API response。业务逻辑只能消费经过 normalization 和 domain validator 确认的 payload。

## Scenario: Model structured output normalization

### 1. Scope / Trigger

- Trigger：新增或修改任何 `engineSendMessageSync`、Codex thread turn、AI helper session、prompt repair、Project Map generation、organizer、AI JSON action 等结构化模型输出消费路径。
- Trigger：看到 `JSON.parse(modelText)`、`JSON.parse(response.text)`、`extractJsonObject(...)`、`structured output`、`Return pure JSON only`、`schema example` 等信号时必须读取本规范。
- 目标：防止切换 Claude / MiniMax / Codex / Gemini / OpenCode 等模型后，因为输出包装、轻微 JSON 损坏、宽松 object syntax 或 schema mismatch 导致功能脆弱。

### 2. Signatures

- Shared parser：`parseModelStructuredJsonObject<T>(input): T`
- Input text：`text: string`
- Domain validator：`validator: (value: unknown) => value is T`
- Payload label：`payloadDescription: string`
- Error type：`ModelStructuredOutputParseError`
- Error kind：`"no_json_object" | "invalid_json" | "schema_mismatch"`

调用方必须提供 domain validator。Parser 只负责文本 normalization，不替业务判断 payload 是否可用。

### 3. Contracts

- Feature code MUST NOT directly call `JSON.parse()` on raw model output.
- Feature code MUST route raw model text through shared model structured-output normalization before using it.
- Normalization MUST treat model output as untrusted and extract candidate JSON objects from raw prose or markdown fences.
- Normalization MAY repair common model formatting defects, including trailing commas, single quoted strings, bare object keys, bare string enum values, placeholder ellipsis, missing closers, and unquoted natural-language string values.
- Normalization MUST NOT branch on provider or model name. Claude, MiniMax, Codex, Gemini, OpenCode, or future engines must use the same parser contract.
- Parsed JSON MUST pass a caller-owned validator before entering business logic.
- Parsed but validator-rejected JSON MUST be classified as schema mismatch, not success.
- Repair retry MUST be bounded. If a feature makes a model repair call, use at most one JSON-only repair attempt unless a separate OpenSpec change explicitly widens the policy.
- If normalization and bounded repair fail, the feature MUST fail closed and MUST NOT persist partial trusted data.
- Failure diagnostics MUST preserve enough message context to explain whether failure was no JSON object, invalid JSON, or schema mismatch.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 模型返回 markdown fence JSON | 提取 fence 内候选并 validator 通过后使用 | 把整段 markdown 直接 `JSON.parse` |
| 模型返回前后解释 + JSON | 扫描候选 JSON object | 要求模型必须裸 JSON 才能工作 |
| 模型返回 bare keys / trailing commas | 本地 bounded repair 后再 parse | 为某个模型写特殊分支 |
| 模型返回中文裸字符串值 | quote 成 JSON string 并保留原文 | 只支持 ASCII enum，导致中文内容失败 |
| 模型返回 valid JSON 但 shape 不对 | `schema_mismatch` / domain validation failure | 把可 parse JSON 当成业务 payload |
| repair 仍失败 | fail closed + visible diagnostic | 写入 partial candidates / partial map / partial manifest |
| 切换模型 provider | 继续走同一 normalization contract | 按模型名选择不同 parser |

### 5. Good / Base / Bad Cases

- Good：Project Map generation 调用 shared parser，并传入 `isProjectMapAiPayloadShape` validator；organizer 调用同一 parser，并传入 `isOrganizerPayloadShape` validator。
- Base：模型严格返回合法 JSON，shared parser strict parse 后 validator 通过。
- Bad：业务函数里写 `const parsed = JSON.parse(response.text)`，然后直接创建 candidates 或更新 dataset。
- Bad：为了 MiniMax / Claude 单独写 `if (model.includes(...))` parser branch。
- Bad：repair prompt 无限循环，或失败后写入半成品。

### 6. Tests Required

修改结构化模型输出路径时，至少覆盖相关路径中的这些断言点：

- strict JSON success：合法 payload 能通过 validator。
- wrapper extraction：markdown fence 或 prose-wrapped JSON 能被提取。
- lenient repair：bare key、trailing comma、bare enum、中文裸字符串至少覆盖一个或复用 shared utility tests。
- schema mismatch：valid JSON but wrong shape 不进入业务。
- repair retry：初次失败时最多一次 JSON-only repair call。
- fail closed：repair 后仍失败时不写 partial trusted data。
- provider agnostic：测试名称和实现不得依赖具体模型名特判。

### 7. Wrong vs Correct

#### Wrong

```typescript
const response = await engineSendMessageSync(workspaceId, request);
const payload = JSON.parse(response.text) as OrganizerPayload;
return createCandidates(payload.moves);
```

问题：这把 model text 当成 API response。模型只要多输出一句话、少一个 bracket、或返回 shape 不对，就会让业务脆弱或写入错误数据。

#### Correct

```typescript
const response = await engineSendMessageSync(workspaceId, request);
const payload = parseModelStructuredJsonObject({
  text: response.text,
  validator: isOrganizerPayloadShape,
  payloadDescription: "organizer JSON payload",
});
return createCandidatesFromValidatedPayload(payload);
```

#### Correct: bounded repair

```typescript
try {
  return parseModelStructuredJsonObject({ text, validator, payloadDescription });
} catch (validationError) {
  const repairText = await requestOneJsonOnlyRepair({ originalPrompt, invalidOutput: text, validationError });
  return parseModelStructuredJsonObject({ text: repairText, validator, payloadDescription });
}
```

注意：第二次 parse 仍失败时必须向上抛错，由上层 run/task 记录 visible failure，不能吞异常或写半成品。
