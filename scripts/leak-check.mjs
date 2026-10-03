// Fails when anything secret-looking ships to the browser (web release standard: grep the built
// .next/static output before every deploy). Three checks:
// 1. Key-shaped strings: OpenAI (sk-…), Supabase secret, service_role, GitHub tokens, AWS keys.
// 2. The real values of this app's server secrets (read from .env.local / the environment),
//    so even an oddly shaped key is caught. Values are never printed.
// 3. The AI vendor or model name (owner rule 2026-10-02: users only ever see "AI"), in the client
//    chunks and in the prerendered pages (.next/server/app/**/*.html and .rsc). The rest of
//    .next/server is server code, which legitimately calls the vendor's API, so it isn't scanned.
// Usage: node scripts/leak-check.mjs [dir]   (default .next/static)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? ".next/static";
if (!existsSync(root)) {
  console.error(`leak-check: ${root} not found. Run npm run build first.`);
  process.exit(1);
}

const PATTERNS = [
  // The lookbehind skips words that merely end in "sk-" (tailwind-merge ships "mask-image-…").
  ["OpenAI key", /(?<![A-Za-z0-9])sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["Supabase service role", /service_role/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
];

/** Matches "OpenAI", "openai.com" and model ids such as "gpt-5.4-mini". */
const VENDOR = /openai|gpt-/i;
/** Prerendered HTML and RSC payloads: what a visitor's browser receives for each static page. */
const PAGES = ".next/server/app";

// Add any other server-only env var this app uses.
const SECRET_NAMES = ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GITHUB_TOKEN"];
const secrets = new Map();
for (const file of [".env.local", ".env", ".env.production.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && SECRET_NAMES.includes(m[1]) && m[2].trim().length >= 12) secrets.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
  }
}
for (const name of SECRET_NAMES) if (process.env[name]?.length >= 12) secrets.set(name, process.env[name]);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|css|html|rsc|json|txt|map)$/.test(name)) yield p;
  }
}

let scanned = 0;
const problems = [];
for (const file of files(root)) {
  scanned++;
  const text = readFileSync(file, "utf8");
  for (const [label, re] of PATTERNS) if (re.test(text)) problems.push(`${file}: looks like a ${label}`);
  for (const [name, value] of secrets) if (text.includes(value)) problems.push(`${file}: contains the value of ${name}`);
  if (VENDOR.test(text)) problems.push(`${file}: names the AI vendor or model ("${text.match(VENDOR)[0]}")`);
}

let pages = 0;
if (existsSync(PAGES)) {
  for (const file of files(PAGES)) {
    if (!/\.(html|rsc)$/.test(file)) continue;
    pages++;
    const text = readFileSync(file, "utf8");
    if (VENDOR.test(text)) problems.push(`${file}: names the AI vendor or model ("${text.match(VENDOR)[0]}")`);
  }
} else {
  problems.push(`${PAGES} not found: the prerendered pages weren't checked for the AI vendor name`);
}

if (problems.length) {
  console.error(`leak-check: FAILED\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(
  `leak-check: ${scanned} files in ${root} (${PATTERNS.length} key patterns, ${secrets.size} real secret values, AI vendor name) ` +
    `and ${pages} prerendered pages in ${PAGES} (AI vendor name) checked, nothing found.`,
);
