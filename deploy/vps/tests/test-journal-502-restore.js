/**
 * Guarantees the CSP hotfix cannot reintroduce the server.js SyntaxError
 * that caused production nginx 502 (corrupt script-src-attr array literal).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { execFileSync } = require("child_process");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..", "..");
const cspHotfix = path.join(ROOT, "deploy/vps/HOTFIX-JOURNAL-CLICK-CSP.sh");
const restoreHotfix = path.join(ROOT, "deploy/vps/HOTFIX-JOURNAL-502-RESTORE.sh");
const helmetPath = path.join(ROOT, "deploy/vps/patch-helmet-journal-frames.js");

assert.ok(fs.existsSync(cspHotfix), "CSP hotfix exists");
assert.ok(fs.existsSync(restoreHotfix), "502 restore hotfix exists");
assert.ok(fs.existsSync(helmetPath), "helmet patcher exists");

const csp = fs.readFileSync(cspHotfix, "utf8");
const restore = fs.readFileSync(restoreHotfix, "utf8");
const helmet = fs.readFileSync(helmetPath, "utf8");

// Exact corrupt vs fixed JS object literals
const CORRUPT = '"script-src-attr": ["\'unsafe-inline\']"';
const FIXED = '"script-src-attr": ["\'unsafe-inline\'"]';

// The ORIGINAL buggy python destination (pre-fix) looked like:
//   src.replace(..., "\"script-src-attr\": [\"'unsafe-inline']\"")
// i.e. the second arg ended with unsafe-inline']  (quote AFTER bracket — wrong).
// Detect that pattern as a replace DESTINATION (comma then that string).
const buggyDestination = /replace\([^,]+,\s*"\\"script-src-attr\\": \[\\"\'unsafe-inline\'\]\\""/;
assert.ok(
  !buggyDestination.test(csp),
  "CSP hotfix must not use the original buggy replace DESTINATION"
);

assert.ok(
  csp.includes("node --check"),
  "CSP hotfix must node --check server.js before pm2 restart"
);
assert.ok(
  !/^[^#]*\bpm2\s+restart\s+all\b/m.test(csp),
  "CSP hotfix must not blindly pm2 restart all"
);
assert.ok(
  csp.includes("closing quote MUST be before") ||
    csp.includes("['\\'unsafe-inline\\'']") ||
    csp.includes('\\\'unsafe-inline\\\'"]'),
  "CSP hotfix documents/fixes the quote-before-] requirement"
);

assert.ok(restore.includes("node --check"), "restore must syntax-check");
assert.ok(
  restore.includes("502") && restore.includes("SyntaxError"),
  "restore documents 502 SyntaxError root cause"
);
assert.ok(
  restore.includes("applyJournalEmbedCsp"),
  "restore redeploys bridge CSP click fix"
);
assert.ok(
  restore.includes("injectHardOff") || restore.includes("HARD OFF"),
  "restore keeps screens inject off"
);

assert.ok(
  !helmet.includes("lines.splice(lineStart, 80)"),
  "helmet patcher must not delete 80 arbitrary lines (502 risk)"
);
assert.ok(
  helmet.includes("\"script-src-attr\": [\"'unsafe-inline'\"]"),
  "helmet patch emits valid unsafe-inline array"
);
assert.ok(
  helmet.includes("marker-only strip") ||
    helmet.includes("never delete 80"),
  "helmet strip fallback is safe"
);

// Prove corrupt literal is a SyntaxError; fixed is valid; repair works
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jts-502-"));
const badFile = path.join(tmp, "bad.js");
const goodFile = path.join(tmp, "good.js");
fs.writeFileSync(badFile, `const x = {\n  ${CORRUPT}\n};\n`);
fs.writeFileSync(goodFile, `const x = {\n  ${FIXED}\n};\n`);

let badThrew = false;
try {
  execFileSync(process.execPath, ["--check", badFile], { stdio: "pipe" });
} catch (_) {
  badThrew = true;
}
assert.ok(badThrew, "corrupt script-src-attr must fail node --check");
execFileSync(process.execPath, ["--check", goodFile], { stdio: "pipe" });

fs.writeFileSync(
  badFile,
  fs.readFileSync(badFile, "utf8").replace(CORRUPT, FIXED)
);
execFileSync(process.execPath, ["--check", badFile], { stdio: "pipe" });

console.log("OK — 502 restore guards passed (corrupt CSP replace blocked)");
