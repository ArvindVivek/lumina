// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/lib/ai.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// The one file in a Kitchen Labs web app that talks to a model.
//
// Org rule: every AI call uses OpenAI through the shared OPENAI_API_KEY, from server code only
// (route handlers, server actions). This mirrors templates/edge-functions/_shared/ai.ts so iOS
// edge functions and web routes behave the same: strict JSON output, friendly errors, the same
// SSE event shapes. Guides: docs/web/ai.md, docs/backend/ai-openai.md (token-efficiency rule).
import "server-only";

export const DEFAULT_MODEL = "gpt-5.4-mini";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
/** People wait on these calls. 20 s leaves room for a fallback inside a 30 s route budget. */
const DEFAULT_TIMEOUT_MS = 20_000;
/** A stream shows progress as it goes, so it may run longer than a single answer. */
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;

/** gpt-5.4-mini accepts "none" | "low" | "medium" | "high" (not "minimal"). */
export type ReasoningEffort = "none" | "low" | "medium" | "high";

export type ImageInput = { url: string } | { base64: string; mimeType: string };

export interface TextRequest {
  system: string;
  user: string;
  images?: ImageInput[];
  imageDetail?: "low" | "high" | "auto";
  model?: string;
  /** Default "none": raise only when an eval shows the lower effort fails. `null` leaves it out
   *  (for a model without reasoning, like gpt-4.1-mini). */
  reasoningEffort?: ReasoningEffort | null;
  /** Cap it: every output token costs, and a cap turns a runaway answer into a clean error. */
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Pass `req.signal` so a closed tab stops the model call. */
  signal?: AbortSignal;
  /** Names the call in the usage log line, e.g. "tips". */
  label?: string;
  /** Called with the token counts OpenAI reports (cost checks, metrics). Streams call it at the end. */
  onUsage?: (usage: TokenUsage) => void;
}

export interface TokenUsage {
  input: number;
  /** Part of `input` served from OpenAI's prompt cache (billed at a discount). */
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
  /** Technical detail: console only, never sent to the browser. */
  readonly detail: unknown;

  constructor(code: AIErrorCode, detail?: unknown) {
    super(`[ai] ${code}`);
    this.name = "AIError";
    this.code = code;
    this.userMessage = MESSAGES[code];
    this.status = STATUS[code];
    this.detail = detail;
  }
}

/** Maps a non-2xx OpenAI response to an AIError. */
export function errorFromStatus(status: number, body = ""): AIError {
  if (status === 401 || status === 403) return new AIError("not_configured", `${status} ${body}`);
  // 429 means two different things: a rate limit (retry soon) or an empty balance (retrying
  // can't help). Tell them apart so people aren't told to "try again in a minute".
  if (status === 429 && /insufficient_quota|credit_balance_exhausted|billing_hard_limit/.test(body)) {
    console.error("[ai] OpenAI balance is empty (insufficient_quota): AI features are paused");
    return new AIError("paused", body);
  }
  if (status === 429) return new AIError("busy", body);
  if (status >= 500) return new AIError("unavailable", `${status} ${body}`);
  return new AIError("failed", `${status} ${body}`);
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
// Request building

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

/** One console line per call, so cost and the answering path show up in the runtime logs
 *  (the same fields as templates/edge-functions/_shared/ai.ts). */
export function logUsage(label: string, model: string, usage: Usage | undefined, ms: number): void {
  console.info(
    `[ai] provider: openai label=${label} model=${model} in=${usage?.prompt_tokens ?? "?"} ` +
      `cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} out=${usage?.completion_tokens ?? "?"} ` +
      `reasoning=${usage?.completion_tokens_details?.reasoning_tokens ?? 0} ms=${Math.round(ms)}`,
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

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AIError("not_configured", "OPENAI_API_KEY is not set");
  return key;
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

/** The chat-completions body. Exported for tests. */
export function buildBody(req: TextRequest | JSONRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model ?? DEFAULT_MODEL,
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
 * Lists the ways a schema breaks OpenAI's strict mode (empty = fine). generateJSON refuses a
 * broken schema before spending a request; pin your schemas with a test that expects [].
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

function signalFor(req: TextRequest, fallbackMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(req.timeoutMs ?? fallbackMs);
  return req.signal ? AbortSignal.any([timeout, req.signal]) : timeout;
}

async function post(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const key = requireKey();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw toAIError(err);
  }
  if (!res.ok) throw errorFromStatus(res.status, await res.text().catch(() => ""));
  return res;
}

// ---------------------------------------------------------------------------------------------
// Calls

/** One structured-output call. Returns the parsed object; throws AIError. */
export async function generateJSON<T>(req: JSONRequest): Promise<T> {
  const problems = strictSchemaProblems(req.schema.schema);
  if (problems.length) throw new AIError("failed", `schema ${req.schema.name} is not strict: ${problems.join("; ")}`);

  const started = performance.now();
  const body = buildBody(req, false);
  const res = await post(body, signalFor(req, DEFAULT_TIMEOUT_MS));

  let data: { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]; usage?: Usage };
  try {
    data = await res.json();
  } catch (err) {
    throw toAIError(err);
  }
  logUsage(req.label ?? req.schema.name, String(body.model), data.usage, performance.now() - started);
  reportUsage(req, data.usage);

  const choice = data.choices?.[0];
  if (!choice) throw new AIError("bad_answer", data);
  if (choice.message?.refusal) throw new AIError("refused", choice.message.refusal);
  if (choice.finish_reason === "length") throw new AIError("too_long", "finish_reason=length");
  if (choice.finish_reason === "content_filter") throw new AIError("refused", "finish_reason=content_filter");
  try {
    return JSON.parse(choice.message?.content ?? "") as T;
  } catch (err) {
    throw new AIError("bad_answer", err);
  }
}

type StreamChunk = {
  error?: unknown;
  usage?: Usage | null;
  choices?: { delta?: { content?: unknown; refusal?: unknown }; finish_reason?: string | null }[];
};

async function* streamDeltas(req: TextRequest | JSONRequest, label: string): AsyncGenerator<string> {
  const started = performance.now();
  const body = buildBody(req, true);
  const res = await post(body, signalFor(req, DEFAULT_STREAM_TIMEOUT_MS));
  if (!res.body) throw new AIError("unavailable", "response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let refusal = "";
  let finishReason: string | null = null;
  let usage: Usage | undefined;
  let sawDone = false;

  // Returns the content delta of one SSE line (or null), recording refusal/finish/usage.
  const handleLine = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") {
      sawDone = true;
      return null;
    }
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return null; // Lines are split on "\n", so this is a malformed line, not a partial one.
    }
    if (chunk.error) throw new AIError("unavailable", chunk.error);
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) return null;
    if (typeof choice.delta?.refusal === "string") refusal += choice.delta.refusal;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const content = choice.delta?.content;
    return typeof content === "string" && content.length ? content : null;
  };

  try {
    while (!sawDone) {
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
        if (sawDone) break;
      }
    }
    const tail = handleLine(buffer + decoder.decode());
    if (tail) yield tail;
  } finally {
    reader.cancel().catch(() => {});
    // Logged even when the stream broke off: those tokens were still billed.
    logUsage(label, String(body.model), usage, performance.now() - started);
    reportUsage(req, usage);
  }

  if (refusal) throw new AIError("refused", refusal);
  if (finishReason === "length") throw new AIError("too_long", "finish_reason=length");
  if (finishReason === "content_filter") throw new AIError("refused", "finish_reason=content_filter");
  if (!finishReason) throw new AIError("unavailable", "stream ended without finish_reason");
}

/** Streams plain text deltas. Throws AIError (after the last delta) when the answer is cut off. */
export function streamText(req: TextRequest): AsyncGenerator<string> {
  return streamDeltas(req, req.label ?? "text");
}

/**
 * Streams the raw text deltas of a strict-schema JSON answer. Accumulate them and JSON.parse the
 * whole text at the end (sseResponse does this with `json: true`).
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
