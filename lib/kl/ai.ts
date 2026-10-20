// KL Web 1.1.6, from kitchenlabs-kit/web/kl-web/lib/ai.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// The one file in a Kitchen Labs web app that talks to a model.
//
// Org rule: every AI call goes to the Claude API first (ANTHROPIC_API_KEY), falls back to OpenAI
// (OPENAI_API_KEY) when Claude is missing, busy, out of credit, down or slow, and the app falls
// back to its own built-in answer when both fail. Server code only (route handlers, server
// actions). This mirrors templates/edge-functions/_shared/ai.ts so iOS edge functions and web
// routes behave the same: strict JSON output, friendly errors, the same SSE event shapes.
// Guides: docs/web/ai.md, docs/backend/ai.md (token-efficiency rule).
import "server-only";

/** Claude's cheap, fast tier: the first choice for every call (the owner has Claude API credit). */
export const CLAUDE_MODEL = "claude-haiku-5-5";
/** The fallback when Claude can't answer. */
export const OPENAI_MODEL = "gpt-5.4-mini";
export const DEFAULT_MODEL = CLAUDE_MODEL;
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
/** Claude requires max_tokens. 2048 fits every answer the apps ask for; set maxOutputTokens to cap lower. */
const CLAUDE_MAX_TOKENS = 2048;
/** Extra max_tokens for Claude tiers that always think (Sonnet, Opus): low-effort thinking fits in
 *  4096, so maxOutputTokens keeps meaning the answer. */
const THINKING_HEADROOM = 4096;
/** People wait on these calls. 20 s leaves room for a fallback inside a 30 s route budget. */
const DEFAULT_TIMEOUT_MS = 20_000;
/** A stream shows progress as it goes, so it may run longer than a single answer. */
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;
/** When another provider follows, the first gets 60% of the time budget (12 s of the 20 s
 *  default), so the fallback still fits inside it. A provider tried last gets all that is left. */
const FIRST_TRY_SHARE = 0.6;
/** A Claude stream that shows nothing for 12 s is stuck; switching to OpenAI beats waiting longer. */
const CLAUDE_FIRST_DELTA_MS = 12_000;

export type Provider = "anthropic" | "openai";
const DEFAULT_PROVIDERS: readonly Provider[] = ["anthropic", "openai"];

/** OpenAI only (Claude ignores it). gpt-5.4-mini accepts "none" | "low" | "medium" | "high" (not "minimal"). */
export type ReasoningEffort = "none" | "low" | "medium" | "high";

export type ImageInput = { url: string } | { base64: string; mimeType: string };

export interface TextRequest {
  system: string;
  user: string;
  images?: ImageInput[];
  /** OpenAI only. */
  imageDetail?: "low" | "high" | "auto";
  /** A "claude-…" name replaces the Claude model; any other name replaces only the OpenAI fallback. */
  model?: string;
  /** The OpenAI model used when OpenAI answers. Default: `model` when it isn't a "claude-…" name,
   *  else OPENAI_MODEL. */
  fallbackModel?: string;
  /** Providers to try, in order. Default ["anthropic", "openai"]. ["openai"] pins OpenAI, for a
   *  feature where an eval shows Claude falls short; ["anthropic"] means no fallback. */
  providers?: Provider[];
  /** Default "none": raise only when an eval shows the lower effort fails. OpenAI gets it as
   *  reasoning_effort (`null` leaves it out, for a model without reasoning like gpt-4.1-mini).
   *  Claude Sonnet/Opus get it as effort ("none" counts as "low"); Haiku runs without thinking. */
  reasoningEffort?: ReasoningEffort | null;
  /** Cap it: every output token costs, and a cap turns a runaway answer into a clean error. */
  maxOutputTokens?: number;
  /** The whole budget, fallback included. */
  timeoutMs?: number;
  /** Pass `req.signal` so a closed tab stops the model call. */
  signal?: AbortSignal;
  /** Names the call in the usage log line, e.g. "tips". */
  label?: string;
  /** Called with the token counts of the provider that answered (cost checks, metrics). Streams
   *  call it at the end. */
  onUsage?: (usage: TokenUsage) => void;
}

export interface TokenUsage {
  input: number;
  /** Part of `input` served from the provider's prompt cache (billed at a discount). */
  cachedInput: number;
  output: number;
}

export interface JSONRequest extends TextRequest {
  /** Strict mode: every object has `additionalProperties: false` and lists every property in
   *  `required`; optional fields are `["string", "null"]`. `maxItems` is not allowed. */
  schema: { name: string; schema: Record<string, unknown> };
}

// ---------------------------------------------------------------------------------------------
// Errors: every failure becomes an AIError with a plain-English message for people and the
// technical detail for the console.
//
// Log rule: logs (and AIError.detail) never hold the prompt, user content, images, the model's
// answer or a key. They keep the code, provider, model, HTTP status, the provider's error type and
// message (clipped to 200 characters), the request id and schema-mismatch paths (no values).

const LOG_MAX = 200;

/** Clips text for a log line and blanks anything key-shaped. */
function clip(text: string): string {
  const clean = text.replace(/sk-[A-Za-z0-9_*.-]+/g, "sk-[redacted]").replace(/\s+/g, " ").trim();
  return clean.length > LOG_MAX ? `${clean.slice(0, LOG_MAX)}…` : clean;
}

/** The provider's error type and message from an error body, never the rest of the body. */
function providerError(status: number, body: string, requestId?: string | null): string {
  let text = body;
  try {
    const parsed = JSON.parse(body);
    const e = parsed?.error ?? parsed;
    const parts = [e?.type ?? e?.code, e?.message].filter((p): p is string => typeof p === "string" && p.length > 0);
    text = parts.length ? parts.join(": ") : "";
  } catch {
    // Not JSON (a gateway page): its clipped text is all there is.
  }
  return clip(`${status} ${text}`) + (requestId ? ` request_id=${requestId}` : "");
}

/** Reduces any detail to a short log-safe string. JSON parse errors quote the text they failed
 *  on (the model's answer), so they are reduced to their name. */
function logSafe(detail: unknown): string | undefined {
  if (detail === undefined || detail === null) return undefined;
  if (typeof detail === "string") return clip(detail);
  const e = detail as { name?: unknown; type?: unknown; message?: unknown };
  if (e.name === "SyntaxError") return "SyntaxError: the answer is not valid JSON";
  if (typeof e.name === "string" && typeof e.message === "string") return clip(`${e.name}: ${e.message}`);
  if (typeof e.type === "string" || typeof e.message === "string") {
    return clip([e.type, e.message].filter((p) => typeof p === "string").join(": "));
  }
  return "[detail withheld]";
}

export type AIErrorCode =
  | "not_configured"
  | "busy"
  | "paused"
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "refused"
  | "too_long"
  | "bad_answer"
  | "failed";

const MESSAGES: Record<AIErrorCode, string> = {
  not_configured: "The AI service isn't set up yet.",
  busy: "The AI service is busy right now. Try again in a minute.",
  paused: "AI features are paused right now. Everything else still works.",
  unavailable: "The AI service is having trouble. Try again in a minute.",
  timeout: "The AI took too long to answer. Please try again.",
  cancelled: "The request was cancelled.",
  refused: "We can't help with that request.",
  too_long: "That was too much to process at once. Try a smaller request.",
  bad_answer: "We got an unreadable answer. Please try again.",
  failed: "We couldn't get an answer this time. Please try again.",
};

/** HTTP status a route should answer with for each code. */
const STATUS: Record<AIErrorCode, number> = {
  not_configured: 503,
  busy: 503,
  paused: 503,
  unavailable: 503,
  timeout: 504,
  cancelled: 499,
  refused: 422,
  too_long: 422,
  bad_answer: 502,
  failed: 502,
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  /** Safe to show to a person. */
  readonly userMessage: string;
  readonly status: number;
  /** Technical detail: console only, never sent to the browser. Always a short log-safe string
   *  (see the log rule above), whatever was passed in. */
  readonly detail: unknown;

  constructor(code: AIErrorCode, detail?: unknown) {
    super(`[ai] ${code}`);
    this.name = "AIError";
    this.code = code;
    this.userMessage = MESSAGES[code];
    this.status = STATUS[code];
    this.detail = logSafe(detail);
  }
}

/** Maps a non-2xx OpenAI response to an AIError. The detail keeps only the error type and message. */
export function errorFromStatus(status: number, body = "", requestId?: string | null): AIError {
  const detail = providerError(status, body, requestId);
  if (status === 401 || status === 403) return new AIError("not_configured", detail);
  // 429 means two different things: a rate limit (retry soon) or an empty balance (retrying
  // can't help). Tell them apart so people aren't told to "try again in a minute".
  if (status === 429 && /insufficient_quota|credit_balance_exhausted|billing_hard_limit/.test(body)) {
    console.error("[ai] OpenAI balance is empty (insufficient_quota): AI features are paused");
    return new AIError("paused", detail);
  }
  if (status === 429) return new AIError("busy", detail);
  if (status >= 500) return new AIError("unavailable", detail);
  return new AIError("failed", detail);
}

/** Maps a non-2xx Claude API response to an AIError. The detail keeps only the error type and message. */
export function anthropicErrorFromStatus(status: number, body = "", requestId?: string | null): AIError {
  const detail = providerError(status, body, requestId);
  if (status === 401 || status === 403) return new AIError("not_configured", detail);
  // An empty credit balance comes back as a 400 (or a 402 billing_error); retrying can't help.
  if (status === 402 || (status === 400 && /credit balance/i.test(body))) {
    console.error("[ai] Claude credit balance is too low: Claude calls are paused");
    return new AIError("paused", detail);
  }
  if (status === 429) return new AIError("busy", detail);
  if (status === 413) return new AIError("too_long", detail);
  // 529 is "overloaded".
  if (status >= 500) return new AIError("unavailable", detail);
  return new AIError("failed", detail);
}

/** Turns anything thrown during an AI call into an AIError. */
export function toAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  const name = (err as { name?: unknown } | null)?.name;
  if (name === "TimeoutError") return new AIError("timeout", err);
  if (name === "AbortError") return new AIError("cancelled", err);
  // fetch() rejects with a TypeError when the network or DNS fails.
  if (err instanceof TypeError) return new AIError("unavailable", err);
  return new AIError("failed", err);
}

/** Logs the detail and returns `{ error: { code, message } }` with the right status. */
export function aiErrorResponse(err: unknown): Response {
  const e = toAIError(err);
  console.error(`[ai] ${e.code}`, e.detail);
  return Response.json({ error: { code: e.code, message: e.userMessage } }, { status: e.status });
}

// ---------------------------------------------------------------------------------------------
// Usage logging

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

type AnthropicUsage = {
  input_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  output_tokens?: number;
};

/** One console line per OpenAI call, so cost and the answering path show up in the runtime logs
 *  (the same fields as templates/edge-functions/_shared/ai.ts). */
export function logUsage(label: string, model: string, usage: Usage | undefined, ms: number): void {
  console.info(
    `[ai] provider: openai label=${label} model=${model} in=${usage?.prompt_tokens ?? "?"} ` +
      `cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} out=${usage?.completion_tokens ?? "?"} ` +
      `reasoning=${usage?.completion_tokens_details?.reasoning_tokens ?? 0} ms=${Math.round(ms)}`,
  );
}

/** Claude reports cache reads and writes apart from input_tokens; add them so `in` means the
 *  whole prompt and `cached` is part of it, as on OpenAI. */
function claudeTokens(usage: AnthropicUsage): TokenUsage {
  const cached = usage.cache_read_input_tokens ?? 0;
  return {
    input: (usage.input_tokens ?? 0) + cached + (usage.cache_creation_input_tokens ?? 0),
    cachedInput: cached,
    output: usage.output_tokens ?? 0,
  };
}

function logClaudeUsage(label: string, model: string, usage: AnthropicUsage | undefined, ms: number): void {
  const t = usage ? claudeTokens(usage) : undefined;
  console.info(
    `[ai] provider: anthropic label=${label} model=${model} in=${t?.input ?? "?"} ` +
      `cached=${t?.cachedInput ?? 0} out=${t?.output ?? "?"} ms=${Math.round(ms)}`,
  );
}

function reportUsage(req: TextRequest, usage: Usage | undefined): void {
  if (!req.onUsage || !usage) return;
  req.onUsage({
    input: usage.prompt_tokens ?? 0,
    cachedInput: usage.prompt_tokens_details?.cached_tokens ?? 0,
    output: usage.completion_tokens ?? 0,
  });
}

function reportClaudeUsage(req: TextRequest, usage: AnthropicUsage | undefined): void {
  if (req.onUsage && usage) req.onUsage(claudeTokens(usage));
}

// ---------------------------------------------------------------------------------------------
// Request building

function claudeModel(req: TextRequest): string {
  return req.model?.startsWith("claude") ? req.model : CLAUDE_MODEL;
}

function openAIModel(req: TextRequest): string {
  return req.fallbackModel ?? (req.model && !req.model.startsWith("claude") ? req.model : OPENAI_MODEL);
}

/** The providers to try, in order: `req.providers` without unknowns or repeats, else the default. */
function providerOrder(req: TextRequest): Provider[] {
  const picked = (req.providers ?? []).filter((p): p is Provider => p === "anthropic" || p === "openai");
  return picked.length ? [...new Set(picked)] : [...DEFAULT_PROVIDERS];
}

/** Constraints Claude's structured outputs reject (a 400). They are dropped from the schema sent to
 *  Claude only; apps check ranges and lengths themselves, as before. */
const STRICT_UNSUPPORTED = new Set([
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "maxItems", "uniqueItems", "minProperties", "maxProperties",
]);
const STRICT_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);

/** The request schema in the form Claude's structured outputs accept: unsupported constraints
 *  dropped, `oneOf` as `anyOf`, `minItems` above 1 dropped, typed enums split. Exported for tests. */
export function claudeToolSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(claudeToolSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (STRICT_UNSUPPORTED.has(key)) continue;
    if (key === "minItems" && typeof value === "number" && value > 1) continue;
    if (key === "format" && !STRICT_FORMATS.has(String(value))) continue;
    if (key === "enum" || key === "const" || key === "required") out[key] = value;
    else if (key === "properties" || key === "$defs" || key === "definitions") {
      out[key] = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, claudeToolSchema(v)]));
    } else out[key === "oneOf" ? "anyOf" : key] = claudeToolSchema(value);
  }
  return splitTypedEnum(out);
}

/**
 * Claude's structured outputs check every enum/const value against one declared type, so a nullable
 * enum like `{type: ["string", "null"], enum: ["light", null]}` is a 400. Splits a type union
 * with enum or const into one anyOf branch per type, each with only its own values; the null
 * branch stays only when null is allowed.
 */
function splitTypedEnum(node: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(node.type) || node.type.length < 2 || !("enum" in node || "const" in node)) return node;
  const { type, enum: values, const: constant, description, ...rest } = node;
  const isConst = "const" in node;
  const allowed = isConst ? [constant] : Array.isArray(values) ? values : [];
  const branches = (type as unknown[]).flatMap((t): Record<string, unknown>[] => {
    const own = allowed.filter((v) => isType(v, t));
    if (!own.length) return [];
    if (t === "null") return [{ type: "null" }];
    return [isConst ? { ...rest, type: t, const: constant } : { ...rest, type: t, enum: own }];
  });
  if (!branches.length) return node;
  const split = branches.length === 1 ? branches[0] : { anyOf: branches };
  return description === undefined ? split : { description, ...split };
}

/** The Claude Messages API body. Exported for tests. JSON requests use structured outputs
 *  (`output_config.format`), so the answer is JSON text that matches the schema; it is still
 *  checked locally against the full schema. A forced tool would be simpler, but Sonnet 5.5,
 *  Opus 5.5 and Fable 5.1 reject a forced tool_choice. */
export function buildAnthropicBody(req: TextRequest | JSONRequest, stream: boolean): Record<string, unknown> {
  const model = claudeModel(req);
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxOutputTokens ?? CLAUDE_MAX_TOKENS,
    system: req.system,
    messages: [
      {
        role: "user",
        content: req.images?.length
          ? [
              ...req.images.map((img) => ({
                type: "image",
                source:
                  "url" in img
                    ? { type: "url", url: img.url }
                    : { type: "base64", media_type: img.mimeType, data: img.base64 },
              })),
              { type: "text", text: req.user },
            ]
          : req.user,
      },
    ],
  };
  const outputConfig: Record<string, unknown> = {};
  if (model.startsWith("claude-haiku")) {
    // Haiku thinks before answering unless told not to. Apps size maxOutputTokens for an answer
    // with no reasoning (OpenAI's "none"), so turn it off: faster, cheaper, and the cap still
    // means the answer.
    body.thinking = { type: "disabled" };
  } else {
    // Sonnet 5.5 and Opus 5.5 always think (they reject "disabled"), and thinking counts toward
    // max_tokens. reasoningEffort sets how much ("none" counts as "low"), and the cap gets
    // THINKING_HEADROOM on top so it still roughly means the answer. Unused tokens cost nothing.
    outputConfig.effort = req.reasoningEffort === "medium" || req.reasoningEffort === "high" ? req.reasoningEffort : "low";
    body.max_tokens = (req.maxOutputTokens ?? CLAUDE_MAX_TOKENS) + THINKING_HEADROOM;
  }
  if ("schema" in req) outputConfig.format = { type: "json_schema", schema: claudeToolSchema(req.schema.schema) };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;
  if (stream) body.stream = true;
  return body;
}

function userContent(req: TextRequest) {
  if (!req.images?.length) return req.user;
  return [
    { type: "text", text: req.user },
    ...req.images.map((img) => ({
      type: "image_url",
      image_url: {
        url: "url" in img ? img.url : `data:${img.mimeType};base64,${img.base64}`,
        detail: req.imageDetail ?? "auto",
      },
    })),
  ];
}

/** The OpenAI chat-completions body (the fallback). Exported for tests. */
export function buildBody(req: TextRequest | JSONRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: openAIModel(req),
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: userContent(req) },
    ],
  };
  if (req.reasoningEffort !== null) body.reasoning_effort = req.reasoningEffort ?? "none";
  if (req.maxOutputTokens) body.max_completion_tokens = req.maxOutputTokens;
  if ("schema" in req) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema },
    };
  }
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  return body;
}

/**
 * Lists the ways a schema breaks OpenAI's strict mode (empty = fine). The OpenAI fallback needs
 * strict schemas, so generateJSON refuses a broken one before spending a request; pin your
 * schemas with a test that expects [].
 */
export function strictSchemaProblems(schema: unknown, path = "$"): string[] {
  if (!schema || typeof schema !== "object") return [];
  const node = schema as Record<string, unknown>;
  const problems: string[] = [];
  if ("maxItems" in node) problems.push(`${path}: maxItems is not allowed in strict mode`);
  const types = Array.isArray(node.type) ? node.type : [node.type];
  if (types.includes("object")) {
    const props = (node.properties ?? {}) as Record<string, unknown>;
    if (node.additionalProperties !== false) problems.push(`${path}: needs additionalProperties: false`);
    const required = Array.isArray(node.required) ? node.required : [];
    for (const key of Object.keys(props)) {
      if (!required.includes(key)) problems.push(`${path}.${key}: must be listed in required`);
      problems.push(...strictSchemaProblems(props[key], `${path}.${key}`));
    }
  }
  if (node.items) problems.push(...strictSchemaProblems(node.items, `${path}[]`));
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(node[key])) {
      (node[key] as unknown[]).forEach((s, i) => problems.push(...strictSchemaProblems(s, `${path}.${key}[${i}]`)));
    }
  }
  for (const [name, def] of Object.entries((node.$defs ?? {}) as Record<string, unknown>)) {
    problems.push(...strictSchemaProblems(def, `${path}.$defs.${name}`));
  }
  return problems;
}

function isType(value: unknown, type: unknown): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "string":
    case "boolean":
      return typeof value === type;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/** Follows a local `$ref` such as "#/$defs/step". */
function resolveRef(root: unknown, ref: string): unknown {
  if (!ref.startsWith("#")) return undefined;
  let node: unknown = root;
  for (const part of ref.slice(1).split("/").filter(Boolean)) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return node;
}

/**
 * Lists the ways `value` breaks `schema` (empty = it matches): type (with ["x", "null"] unions),
 * required, additionalProperties: false, enum, const, items, nested objects, anyOf / oneOf /
 * allOf and local $ref. Both providers answer in strict mode, but Claude's strict schema drops
 * some constraints, so every answer is checked here before an app sees it; a mismatch is a
 * bad_answer.
 */
export function schemaMismatches(value: unknown, schema: unknown, root: unknown = schema, path = "$"): string[] {
  if (!schema || typeof schema !== "object") return [];
  const node = schema as Record<string, unknown>;
  if (typeof node.$ref === "string") {
    const target = resolveRef(root, node.$ref);
    return target ? schemaMismatches(value, target, root, path) : [`${path}: unknown $ref ${node.$ref}`];
  }
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = node[key];
    if (Array.isArray(options) && !options.some((s) => schemaMismatches(value, s, root, path).length === 0)) {
      return [`${path}: matches none of ${key}`];
    }
  }
  const problems: string[] = [];
  if (Array.isArray(node.allOf)) for (const s of node.allOf) problems.push(...schemaMismatches(value, s, root, path));
  if (node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((t) => isType(value, t))) return [...problems, `${path}: expected ${types.join(" | ")}`];
  }
  const same = (a: unknown) => a === value || JSON.stringify(a) === JSON.stringify(value);
  if (Array.isArray(node.enum) && !node.enum.some(same)) problems.push(`${path}: not one of the allowed values`);
  if ("const" in node && !same(node.const)) problems.push(`${path}: not the required value`);
  if (isType(value, "object")) {
    const obj = value as Record<string, unknown>;
    const props = (node.properties ?? {}) as Record<string, unknown>;
    for (const key of Array.isArray(node.required) ? node.required : []) {
      if (!(key in obj)) problems.push(`${path}.${key}: missing`);
    }
    for (const [key, v] of Object.entries(obj)) {
      if (key in props) problems.push(...schemaMismatches(v, props[key], root, `${path}.${key}`));
      else if (node.additionalProperties === false) problems.push(`${path}.${key}: not allowed`);
      else if (node.additionalProperties && typeof node.additionalProperties === "object") {
        problems.push(...schemaMismatches(v, node.additionalProperties, root, `${path}.${key}`));
      }
    }
  }
  if (Array.isArray(value) && node.items) {
    value.forEach((v, i) => problems.push(...schemaMismatches(v, node.items, root, `${path}[${i}]`)));
  }
  return problems;
}

/** Throws bad_answer when an answer doesn't match the request schema. */
function checkAnswer(req: JSONRequest, value: unknown): void {
  const problems = schemaMismatches(value, req.schema.schema);
  if (problems.length) {
    throw new AIError("bad_answer", `answer does not match schema ${req.schema.name}: ${problems.slice(0, 5).join("; ")}`);
  }
}

/** The final check on a streamed JSON answer: it must parse and match the schema. */
function checkStreamedAnswer(req: JSONRequest, text: string): void {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    throw new AIError("bad_answer", err);
  }
  checkAnswer(req, value);
}

function signalFor(req: TextRequest, ms: number, extra?: AbortSignal): AbortSignal {
  const signals = [AbortSignal.timeout(ms), req.signal, extra].filter((s): s is AbortSignal => !!s);
  return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
  mapStatus: (status: number, body: string, requestId?: string | null) => AIError,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw toAIError(err);
  }
  if (!res.ok) {
    const requestId = res.headers.get("request-id") ?? res.headers.get("x-request-id");
    throw mapStatus(res.status, await res.text().catch(() => ""), requestId);
  }
  return res;
}

function postClaude(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIError("not_configured", "ANTHROPIC_API_KEY is not set");
  return post(ANTHROPIC_ENDPOINT, { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION }, body, signal, anthropicErrorFromStatus);
}

function postOpenAI(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AIError("not_configured", "OPENAI_API_KEY is not set");
  return post(OPENAI_ENDPOINT, { Authorization: `Bearer ${key}` }, body, signal, errorFromStatus);
}

// ---------------------------------------------------------------------------------------------
// Fallback: Claude first, then OpenAI.

/** Failures another provider can fix ("failed" covers a 400 or 404 from Claude, e.g. a schema
 *  its strict mode won't take). A refusal, an oversized request or a cancel would fail the same
 *  way on OpenAI, so those are final. */
const FALLBACK_CODES: ReadonlySet<AIErrorCode> = new Set(["not_configured", "busy", "paused", "unavailable", "timeout", "bad_answer", "failed"]);

function shouldFallBack(err: AIError, req: TextRequest): boolean {
  return FALLBACK_CODES.has(err.code) && !req.signal?.aborted;
}

/** Logged when the last provider fails, so the reason is in the "[ai]" lines even when the app
 *  catches the error itself. */
function noteGaveUp(provider: Provider, err: AIError): void {
  console.warn(`[ai] provider: ${provider} failed (${err.code}), no provider left`, err.detail);
}

function noteFallback(from: Provider, to: Provider, err: AIError): void {
  if (err.code === "not_configured") console.warn(`[ai] provider: ${from} not configured, using ${to}`);
  else console.warn(`[ai] provider: ${from} failed (${err.code}), using ${to}`, err.detail);
}

/** When every provider fails, the first one's error says most, unless it simply wasn't set up. */
function mostUseful(errors: AIError[]): AIError {
  return errors.find((e) => e.code !== "not_configured") ?? errors[errors.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Calls

async function claudeJSON<T>(req: JSONRequest, timeoutMs: number): Promise<T> {
  const started = performance.now();
  const body = buildAnthropicBody(req, false);
  const res = await postClaude(body, signalFor(req, timeoutMs));

  let data: { content?: { type?: string; text?: unknown }[]; stop_reason?: string | null; usage?: AnthropicUsage };
  try {
    data = await res.json();
  } catch (err) {
    throw toAIError(err);
  }
  logClaudeUsage(req.label ?? req.schema.name, String(body.model), data.usage, performance.now() - started);

  if (data.stop_reason === "refusal") throw new AIError("refused", "stop_reason=refusal");
  if (data.stop_reason === "max_tokens") throw new AIError("too_long", "stop_reason=max_tokens");
  // Thinking blocks may come first; the answer is the text.
  const text = (data.content ?? []).map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : "")).join("");
  if (!text) throw new AIError("bad_answer", `no text in the answer (stop_reason=${data.stop_reason})`);
  let answer: unknown;
  try {
    answer = JSON.parse(text);
  } catch (err) {
    throw new AIError("bad_answer", err);
  }
  checkAnswer(req, answer);
  reportClaudeUsage(req, data.usage);
  return answer as T;
}

async function openAIJSON<T>(req: JSONRequest, timeoutMs: number): Promise<T> {
  const started = performance.now();
  const body = buildBody(req, false);
  const res = await postOpenAI(body, signalFor(req, timeoutMs));

  let data: { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]; usage?: Usage };
  try {
    data = await res.json();
  } catch (err) {
    throw toAIError(err);
  }
  logUsage(req.label ?? req.schema.name, String(body.model), data.usage, performance.now() - started);
  reportUsage(req, data.usage);

  const choice = data.choices?.[0];
  if (!choice) throw new AIError("bad_answer", "no choices in the answer");
  if (choice.message?.refusal) throw new AIError("refused", "the model refused (refusal text not logged)");
  if (choice.finish_reason === "length") throw new AIError("too_long", "finish_reason=length");
  if (choice.finish_reason === "content_filter") throw new AIError("refused", "finish_reason=content_filter");
  let answer: unknown;
  try {
    answer = JSON.parse(choice.message?.content ?? "");
  } catch (err) {
    throw new AIError("bad_answer", err);
  }
  checkAnswer(req, answer);
  return answer as T;
}

/** Time for the next provider: a share of what is left when another follows, else all of it
 *  (at least 1 s, so a late fallback still gets a real try). */
function budgetFor(total: number, started: number, last: boolean): number {
  const remaining = Math.round(total - (performance.now() - started));
  return last ? Math.max(1_000, remaining) : Math.max(1, Math.round(remaining * FIRST_TRY_SHARE));
}

/** One structured-output call: Claude, then OpenAI (or `providers`). Returns the parsed object;
 *  throws AIError. */
export async function generateJSON<T>(req: JSONRequest): Promise<T> {
  const problems = strictSchemaProblems(req.schema.schema);
  if (problems.length) throw new AIError("failed", `schema ${req.schema.name} is not strict: ${problems.join("; ")}`);

  const order = providerOrder(req);
  const total = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = performance.now();
  const errors: AIError[] = [];
  for (let i = 0; ; i++) {
    const last = i === order.length - 1;
    const budget = budgetFor(total, started, last);
    try {
      return order[i] === "anthropic" ? await claudeJSON<T>(req, budget) : await openAIJSON<T>(req, budget);
    } catch (err) {
      const e = toAIError(err);
      errors.push(e);
      if (last || !shouldFallBack(e, req)) {
        noteGaveUp(order[i], e);
        throw last ? mostUseful(errors) : e;
      }
      noteFallback(order[i], order[i + 1], e);
    }
  }
}

/** Reads an SSE body line by line, handing each `data:` payload to `onData`, which returns the
 *  delta to yield (or null) and true once the stream says it is done. */
async function* readSSE(
  res: Response,
  onData: (payload: string) => { delta: string | null; done: boolean },
): AsyncGenerator<string> {
  if (!res.body) throw new AIError("unavailable", "response had no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  const handleLine = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;
    const result = onData(trimmed.slice(5).trim());
    if (result.done) done = true;
    return result.delta;
  };
  try {
    while (!done) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        throw toAIError(err);
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const delta = handleLine(line);
        if (delta) yield delta;
        if (done) break;
      }
    }
    const tail = handleLine(buffer + decoder.decode());
    if (tail) yield tail;
  } finally {
    reader.cancel().catch(() => {});
  }
}

type ClaudeEvent = {
  type?: string;
  message?: { usage?: AnthropicUsage };
  delta?: { type?: string; text?: unknown; stop_reason?: string | null };
  usage?: AnthropicUsage;
  error?: { type?: string; message?: string };
};

/** Claude's text deltas: the answer, or the JSON of a structured-output answer. */
async function* claudeDeltas(
  req: TextRequest | JSONRequest,
  label: string,
  totalMs: number,
  fallbackFollows: boolean,
): AsyncGenerator<string> {
  const json = "schema" in req;
  const started = performance.now();
  const body = buildAnthropicBody(req, true);
  // When a fallback follows, Claude has a shorter budget until the first delta arrives, so a
  // stuck call still leaves time for it. Once text is flowing, the whole stream budget applies.
  const firstDelta = new AbortController();
  const timer = fallbackFollows
    ? setTimeout(
        () => firstDelta.abort(new DOMException("no delta from Claude in time", "TimeoutError")),
        Math.min(CLAUDE_FIRST_DELTA_MS, totalMs * FIRST_TRY_SHARE),
      )
    : undefined;
  let usage: AnthropicUsage | undefined;
  let stopReason: string | null = null;
  let yielded = false;
  let text = "";

  const onData = (payload: string) => {
    let event: ClaudeEvent;
    try {
      event = JSON.parse(payload);
    } catch {
      return { delta: null, done: false }; // Lines are split on "\n", so this is a malformed line, not a partial one.
    }
    if (event.type === "error") {
      const type = event.error?.type;
      throw new AIError(type === "rate_limit_error" ? "busy" : "unavailable", event.error);
    }
    if (event.type === "message_start" && event.message?.usage) usage = { ...event.message.usage };
    if (event.type === "message_delta") {
      if (event.usage) usage = { ...usage, ...event.usage };
      if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
    }
    if (event.type === "message_stop") return { delta: null, done: true };
    if (event.type !== "content_block_delta") return { delta: null, done: false };
    // Text and JSON answers both arrive as text deltas (JSON through structured outputs).
    const value = event.delta?.type === "text_delta" && event.delta.text;
    return { delta: typeof value === "string" && value.length ? value : null, done: false };
  };

  let res: Response;
  try {
    res = await postClaude(body, signalFor(req, totalMs, firstDelta.signal));
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  try {
    for await (const delta of readSSE(res, onData)) {
      if (!yielded) clearTimeout(timer);
      yielded = true;
      text += delta;
      yield delta;
    }
  } finally {
    clearTimeout(timer);
    // Logged even when the stream broke off: those tokens were still billed.
    logClaudeUsage(label, String(body.model), usage, performance.now() - started);
    if (yielded || stopReason) reportClaudeUsage(req, usage);
  }

  if (stopReason === "refusal") throw new AIError("refused", "stop_reason=refusal");
  if (stopReason === "max_tokens") throw new AIError("too_long", "stop_reason=max_tokens");
  if (!stopReason) throw new AIError("unavailable", "stream ended without stop_reason");
  if (!yielded) throw new AIError("bad_answer", "stream had no text");
  if (json) checkStreamedAnswer(req, text);
}

type StreamChunk = {
  error?: unknown;
  usage?: Usage | null;
  choices?: { delta?: { content?: unknown; refusal?: unknown }; finish_reason?: string | null }[];
};

async function* openAIDeltas(req: TextRequest | JSONRequest, label: string, totalMs: number): AsyncGenerator<string> {
  const started = performance.now();
  const body = buildBody(req, true);
  let refusal = "";
  let finishReason: string | null = null;
  let usage: Usage | undefined;

  const onData = (payload: string) => {
    if (payload === "[DONE]") return { delta: null, done: true };
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return { delta: null, done: false }; // Lines are split on "\n", so this is a malformed line, not a partial one.
    }
    if (chunk.error) throw new AIError("unavailable", chunk.error);
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) return { delta: null, done: false };
    if (typeof choice.delta?.refusal === "string") refusal += choice.delta.refusal;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const content = choice.delta?.content;
    return { delta: typeof content === "string" && content.length ? content : null, done: false };
  };

  const res = await postOpenAI(body, signalFor(req, totalMs));
  let text = "";
  try {
    for await (const delta of readSSE(res, onData)) {
      text += delta;
      yield delta;
    }
  } finally {
    // Logged even when the stream broke off: those tokens were still billed.
    logUsage(label, String(body.model), usage, performance.now() - started);
    reportUsage(req, usage);
  }

  if (refusal) throw new AIError("refused", "the model refused (refusal text not logged)");
  if (finishReason === "length") throw new AIError("too_long", "finish_reason=length");
  if (finishReason === "content_filter") throw new AIError("refused", "finish_reason=content_filter");
  if (!finishReason) throw new AIError("unavailable", "stream ended without finish_reason");
  if ("schema" in req) checkStreamedAnswer(req, text);
}

/** Claude's stream, or OpenAI's when Claude fails before its first delta (or `providers`, in
 *  order). Once text has reached the caller there is no switching: the error is thrown after the
 *  last delta. */
async function* streamDeltas(req: TextRequest | JSONRequest, label: string): AsyncGenerator<string> {
  const order = providerOrder(req);
  const total = req.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  const started = performance.now();
  const errors: AIError[] = [];
  for (let i = 0; ; i++) {
    const last = i === order.length - 1;
    // The whole remaining budget: a Claude stream that a fallback follows has its own
    // first-delta deadline instead.
    const remaining = budgetFor(total, started, true);
    const source = order[i] === "anthropic" ? claudeDeltas(req, label, remaining, !last) : openAIDeltas(req, label, remaining);
    let yielded = false;
    try {
      for await (const delta of source) {
        yielded = true;
        yield delta;
      }
      return;
    } catch (err) {
      const e = toAIError(err);
      if (yielded) throw e;
      errors.push(e);
      if (last || !shouldFallBack(e, req)) {
        noteGaveUp(order[i], e);
        throw last ? mostUseful(errors) : e;
      }
      noteFallback(order[i], order[i + 1], e);
    }
  }
}

/** Streams plain text deltas. Throws AIError (after the last delta) when the answer is cut off. */
export function streamText(req: TextRequest): AsyncGenerator<string> {
  return streamDeltas(req, req.label ?? "text");
}

/**
 * Streams the raw text deltas of a strict-schema JSON answer. Accumulate them and JSON.parse the
 * whole text at the end (sseResponse does this with `json: true`). After the last delta the whole
 * answer is checked against the schema; a mismatch throws bad_answer (an `error` event in
 * sseResponse instead of `result`).
 */
export function streamJSON(req: JSONRequest): AsyncGenerator<string> {
  const problems = strictSchemaProblems(req.schema.schema);
  if (problems.length) throw new AIError("failed", `schema ${req.schema.name} is not strict: ${problems.join("; ")}`);
  return streamDeltas(req, req.label ?? req.schema.name);
}

/**
 * Wraps a delta stream as Server-Sent Events with the same shapes the edge functions use:
 * `{"type":"delta","text"}` per delta, then `{"type":"result","data"}` (the parsed JSON when
 * `json` is true, else the full text), or `{"type":"error","code","message"}` on failure.
 */
export function sseResponse(source: AsyncIterable<string>, { json = false }: { json?: boolean } = {}): Response {
  const encoder = new TextEncoder();
  const event = (value: unknown) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const text of source) {
          full += text;
          controller.enqueue(event({ type: "delta", text }));
        }
        let data: unknown = full;
        if (json) {
          try {
            data = JSON.parse(full);
          } catch (err) {
            throw new AIError("bad_answer", err);
          }
        }
        controller.enqueue(event({ type: "result", data }));
      } catch (err) {
        const e = toAIError(err);
        console.error(`[ai] ${e.code}`, e.detail);
        controller.enqueue(event({ type: "error", code: e.code, message: e.userMessage }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
