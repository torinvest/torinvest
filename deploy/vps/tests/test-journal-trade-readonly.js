#!/usr/bin/env node
/**
 * Tests — vue lecture seule TJ Pro v4 (edit=+readonly=1).
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
const BRIDGE = path.join(ROOT, "deploy", "vps", "formation-server", "routes-journal-bridge.js");

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
  assert(php.includes("torinvest-tj-readonly-v4"), "v4 marker");
  assert(php.includes("readonly=1"), "readonly=1 contract");
  assert(php.includes("edit=") && php.includes("&readonly=1"), "goRead uses edit=+readonly=1");
  assert(php.includes("Location:") || php.includes("header('Location"), "legacy redirect");
  assert(!/#6366f1|#7c3aed|#eef2ff|#3730a3/i.test(php), "no purple UI colors");

  const patch = fs.readFileSync(PATCH, "utf8");
  assert(patch.includes("torinvest-journal-readonly-view"), "marker in patch");
  assert(patch.includes("openTrade"), "source rewrite openTrade");
  assert(patch.includes("readonly=1"), "patch uses readonly=1");
  assert(patch.includes("torinvest-tj-readonly-v4"), "patch requires v4");

  const hotfix = fs.readFileSync(HOTFIX, "utf8");
  assert(hotfix.includes("patch-trading-journal-readonly-view.sh"), "hotfix calls patch");
  assert(
    /JOURNAL_HOTFIX_BRANCH:-cursor\/journal-readonly-flag-691a|JOURNAL_HOTFIX_BRANCH:-main/.test(hotfix),
    "hotfix branch pin"
  );
  assert(hotfix.includes("torinvest-tj-readonly-v4"), "hotfix verifies v4");

  if (fs.existsSync(BRIDGE)) {
    const bridge = fs.readFileSync(BRIDGE, "utf8");
    assert(bridge.includes("readonly=1"), "bridge goTrade uses readonly=1");
    assert(bridge.includes("page=history&edit="), "bridge keeps edit=");
    assert(!bridge.includes("?action=view&id="), "bridge no action=view");
  }

  if (hasPhp()) {
    execSync("php -l " + PHP, { stdio: "inherit" });
  } else {
    console.log("php -l skipped (no php)");
  }

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
  // Simulate patch: keep edit=, append readonly=1
  src = src.replace(
    /function\s+openTrade\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
    (body) =>
      body.replace(
        /(['"`][^'"`]*[?&]edit=)(['"`]\s*\+\s*id)/i,
        "$1&readonly=1$2"
      )
  );
  fs.writeFileSync(journal, src);
  console.log("patched");

  const patched = fs.readFileSync(journal, "utf8");
  assert(patched.includes("torinvest-journal-readonly-view"), "marker injected");
  assert(/openTrade[\s\S]*edit=[\s\S]*readonly=1/.test(patched), "openTrade edit=+readonly=1");

  if (hasPhp()) {
    const roFile = path.join(tmp, "ro.php");
    fs.writeFileSync(
      roFile,
      `<?php
$_GET = ['page' => 'history', 'edit' => '4', 'readonly' => '1'];
$_REQUEST = $_GET;
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo !empty($GLOBALS['torinvest_tj_readonly']) ? 'RO=1' : 'RO=0';
echo '|edit=' . ($_GET['edit'] ?? '');
`
    );
    const out = execSync("php " + roFile, { encoding: "utf8" });
    assert(out.includes("RO=1"), "edit=+readonly=1 sets readonly");
    assert(out.includes("edit=4"), "edit kept for TJ loader");
    console.log("readonly flag OK:", out.trim());

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

    const menuFile = path.join(tmp, "menu.php");
    fs.writeFileSync(
      menuFile,
      `<?php
$_GET = ['view' => 'historique'];
$_REQUEST = $_GET;
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo !empty($GLOBALS['torinvest_tj_readonly']) ? 'RO=1' : 'RO=0';
`
    );
    const outM = execSync("php " + menuFile, { encoding: "utf8" });
    assert(outM.includes("RO=0"), "menu view=historique is NOT readonly");
    console.log("menu OK:", outM.trim());

    // Legacy read= should redirect (headers) — in CLI just remap path via fallback
    const legacyFile = path.join(tmp, "legacy.php");
    fs.writeFileSync(
      legacyFile,
      `<?php
// Simulate headers already sent → fallback remap
$_GET = ['page' => 'history', 'read' => '9'];
$_REQUEST = $_GET;
$_SERVER['REQUEST_URI'] = '/trading_journal.php?page=history&read=9';
if (!function_exists('headers_sent_override')) {
  // force fallback by claiming headers sent: call boot after dummy output
}
echo 'x'; // force headers_sent=true for subsequent header()
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo !empty($GLOBALS['torinvest_tj_readonly']) ? '|RO=1' : '|RO=0';
echo '|edit=' . ($_GET['edit'] ?? '');
echo '|readonly=' . ($_GET['readonly'] ?? '');
`
    );
    const outL = execSync("php " + legacyFile, { encoding: "utf8" });
    assert(outL.includes("RO=1"), "legacy read= becomes readonly");
    assert(outL.includes("edit=9"), "legacy sets edit=");
    assert(outL.includes("readonly=1"), "legacy sets readonly=1");
    console.log("legacy read= OK:", outL.trim());

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
    assert(html.includes("torinvest-tj-readonly-v4"), "UI script v4 injected");
    assert(html.includes("Modifier"), "Modifier button");
    assert(html.includes("Retour"), "Retour button");
    assert(html.includes("lecture seule") || html.includes("Mode lecture"), "lecture label");
    assert(/edit=.*readonly=1|readonly=1/.test(html), "JS goRead uses readonly=1");
    assert(html.includes("page=history&edit="), "JS keeps edit= for TJ");
    console.log("ob-filter OK");
  } else {
    console.log("PHP runtime tests skipped (no php binary)");
  }

  console.log("ALL PASS — journal trade readonly v4");
}

main();
