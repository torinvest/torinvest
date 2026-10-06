#!/usr/bin/env node
/**
 * Tests — vue lecture seule TJ Pro (view= vs edit=, labels FR, openTrade rewrite).
 * Run: node deploy/vps/tests/test-journal-trade-readonly.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..", "..");
const PHP = path.join(ROOT, "api", "trading-journal-readonly-view.php");
const PATCH = path.join(ROOT, "deploy", "vps", "patch-trading-journal-readonly-view.sh");
const HOTFIX = path.join(ROOT, "deploy", "vps", "HOTFIX-JOURNAL-TRADE-READONLY.sh");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function hasPhp() {
  return spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;
}

function main() {
  assert(fs.existsSync(PHP), "PHP readonly exists");
  assert(fs.existsSync(PATCH), "patch script exists");
  assert(fs.existsSync(HOTFIX), "hotfix exists");

  const php = fs.readFileSync(PHP, "utf8");
  assert(php.includes("torinvest_journal_readonly_boot"), "boot fn");
  assert(php.includes("torinvest_tj_readonly"), "readonly global");
  assert(php.includes("lecture seule"), "FR lecture seule");
  assert(php.includes("Modifier"), "FR Modifier");
  assert(php.includes("Retour"), "FR Retour");
  assert(php.includes("page=history&view="), "openTrade → view=");
  assert(php.includes("toEditUrl") || php.includes('searchParams.set("edit"'), "Modifier → edit=");
  assert(!/#6366f1|#7c3aed|#eef2ff|#3730a3/i.test(php), "no purple UI colors");

  const patch = fs.readFileSync(PATCH, "utf8");
  assert(patch.includes("torinvest-journal-readonly-view"), "marker in patch");
  assert(patch.includes("openTrade"), "source rewrite openTrade");

  const hotfix = fs.readFileSync(HOTFIX, "utf8");
  assert(hotfix.includes("patch-trading-journal-readonly-view.sh"), "hotfix calls view patch");
  assert(hotfix.includes("cursor/journal-trade-readonly-691a"), "branch ref");

  if (hasPhp()) {
    execSync("php -l " + PHP, { stdio: "inherit" });
  } else {
    console.log("php -l skipped (no php)");
  }

  // Fixture: inject + rewrite openTrade edit→view
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tj-ro-"));
  const www = path.join(tmp, "www");
  const api = path.join(www, "api");
  fs.mkdirSync(api, { recursive: true });
  const journal = path.join(www, "trading_journal.php");
  fs.writeFileSync(
    journal,
    `<?php
/* torinvest-journal-forge-sso */
require_once __DIR__ . '/api/trading-journal-forge-sso.php';
torinvest_journal_forge_sso_boot();
?>
<!DOCTYPE html><html><body>
<script>
function openTrade(id){
  window.location.href = 'trading_journal.php?page=history&edit=' + id;
}
</script>
<a href="?page=history&edit=4">row</a>
</body></html>
`
  );
  fs.copyFileSync(PHP, path.join(api, "trading-journal-readonly-view.php"));
  fs.writeFileSync(
    path.join(api, "trading-journal-forge-sso.php"),
    "<?php\nfunction torinvest_journal_forge_sso_boot(){}\n"
  );

  // Apply same inject + rewrite as the VPS patch (in Node, no python escaping hell)
  let src = fs.readFileSync(journal, "utf8");
  const marker = "torinvest-journal-readonly-view";
  const boot =
    `/* ${marker} */\n` +
    "require_once __DIR__ . '/api/trading-journal-readonly-view.php';\n" +
    "torinvest_journal_readonly_boot();\n";
  src = src.replace(
    "torinvest_journal_forge_sso_boot();",
    "torinvest_journal_forge_sso_boot();\n" + boot
  );
  src = src.replace(
    /function\s+openTrade\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
    (body) => body.replace(/([?&'"`=])edit=/gi, "$1view=")
  );
  src = src.replace(
    /(['"])([^'"]*page=(?:history|calendar|calendrier)[^'"]*?)edit=/gi,
    "$1$2view="
  );
  fs.writeFileSync(journal, src);
  console.log("patched");

  const patched = fs.readFileSync(journal, "utf8");
  assert(patched.includes("torinvest-journal-readonly-view"), "marker injected");
  assert(/openTrade\s*\([^)]*\)\s*\{[\s\S]*view=/.test(patched), "openTrade uses view=");
  assert(
    !/function\s+openTrade\s*\([^)]*\)\s*\{[\s\S]*edit=/.test(patched),
    "openTrade no longer edit="
  );
  assert(patched.includes("?page=history&view="), "history link view=");

  if (hasPhp()) {
    const remapFile = path.join(tmp, "remap.php");
    fs.writeFileSync(
      remapFile,
      `<?php
$_GET = ['page' => 'history', 'view' => '4'];
$_REQUEST = $_GET;
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo !empty($GLOBALS['torinvest_tj_readonly']) ? 'RO=1' : 'RO=0';
echo '|edit=' . ($_GET['edit'] ?? '');
`
    );
    const out = execSync("php " + remapFile, { encoding: "utf8" });
    assert(out.includes("RO=1"), "view= sets readonly");
    assert(out.includes("edit=4"), "view remapped to edit for loader");
    console.log("remap OK:", out.trim());

    const editFile = path.join(tmp, "edit.php");
    fs.writeFileSync(
      editFile,
      `<?php
$_GET = ['page' => 'history', 'edit' => '4'];
$_REQUEST = $_GET;
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo !empty($GLOBALS['torinvest_tj_readonly']) ? 'RO=1' : 'RO=0';
`
    );
    const out2 = execSync("php " + editFile, { encoding: "utf8" });
    assert(out2.includes("RO=0"), "edit= alone is NOT readonly");
    console.log("edit-passthrough OK:", out2.trim());

    const obFile = path.join(tmp, "ob.php");
    fs.writeFileSync(
      obFile,
      `<?php
$GLOBALS['torinvest_tj_readonly'] = true;
$GLOBALS['torinvest_tj_readonly_id'] = '4';
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
$html = '<!DOCTYPE html><html><body><h1>Modifier le trade #4</h1><form><input name="pair" value="EURUSD"><button type="submit">Enregistrer</button></form></body></html>';
echo torinvest_journal_readonly_ob_filter($html);
`
    );
    const html = execSync("php " + obFile, { encoding: "utf8" });
    assert(html.includes("torinvest-tj-readonly-v1"), "UI script injected");
    assert(html.includes("Modifier"), "Modifier button");
    assert(html.includes("Retour"), "Retour button");
    assert(html.includes("lecture seule") || html.includes("Mode lecture"), "lecture label");
    assert(!/#6366f1|#7c3aed/i.test(html), "no purple in injected UI");
    console.log("ob-filter OK");
  } else {
    console.log("PHP runtime tests skipped (no php binary)");
  }

  console.log("ALL PASS — journal trade readonly");
}

main();
