#!/usr/bin/env node
/**
 * Tests — patch vue lecture seule TJ Pro (openTrade edit→view + labels FR).
 * Run: node deploy/vps/tests/test-journal-trade-readonly.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..", "..");
const PHP = path.join(ROOT, "api", "trading-journal-readonly-view.php");
const PATCH = path.join(ROOT, "deploy", "vps", "patch-trading-journal-readonly.sh");
const HOTFIX = path.join(ROOT, "deploy", "vps", "HOTFIX-JOURNAL-TRADE-READONLY.sh");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function hasPhp() {
  const r = spawnSync("php", ["-v"], { encoding: "utf8" });
  return r.status === 0;
}

function main() {
  assert(fs.existsSync(PHP), "PHP readonly file exists");
  assert(fs.existsSync(PATCH), "patch script exists");
  assert(fs.existsSync(HOTFIX), "hotfix script exists");

  const php = fs.readFileSync(PHP, "utf8");
  assert(php.includes("torinvest_journal_readonly_boot"), "boot fn");
  assert(php.includes("TORINVEST_TJ_READONLY"), "readonly const");
  assert(php.includes("lecture seule"), "FR lecture seule");
  assert(php.includes("Modifier"), "FR Modifier");
  assert(php.includes("Retour"), "FR Retour");
  assert(php.includes('searchParams.set("view"'), "navigate view=");
  assert(php.includes('searchParams.set("edit"'), "modifier → edit=");

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
$page = $_GET['page'] ?? 'history';
$edit = $_GET['edit'] ?? null;
?>
<!DOCTYPE html><html><body>
<script>
function openTrade(id){
  window.location.href = 'trading_journal.php?page=history&edit=' + id;
}
</script>
<table>
<tr onclick="openTrade(4)"><td>EURUSD</td></tr>
<a href="?page=history&edit=4">row</a>
<?php if ($edit) { ?>
<h1>Modifier le trade #<?php echo (int)$edit; ?></h1>
<form method="post">
  <label>Actif</label><input name="pair" value="EURUSD" />
  <button type="submit">Enregistrer</button>
</form>
<?php } ?>
</body></html>
`,
    "utf8"
  );
  fs.copyFileSync(PHP, path.join(api, "trading-journal-readonly-view.php"));
  fs.writeFileSync(
    path.join(api, "trading-journal-forge-sso.php"),
    "<?php\nfunction torinvest_journal_forge_sso_boot(){}\n"
  );

  const pyFile = path.join(tmp, "patch_fixture.py");
  fs.writeFileSync(
    pyFile,
    `
import re
from pathlib import Path
path = Path(${JSON.stringify(journal)})
marker = "torinvest-journal-readonly-view"
text = path.read_text(encoding="utf-8")
boot = (
    f"/* {marker} */\\n"
    "require_once __DIR__ . '/api/trading-journal-readonly-view.php';\\n"
    "torinvest_journal_readonly_boot();\\n"
)
sso = "torinvest_journal_forge_sso_boot();"
text = text.replace(sso, sso + "\\n" + boot, 1)
src = text

def rewrite_opentrade(m):
    body = m.group(0)
    return re.sub(r"([?&'\\"\`=])edit=", r"\\\\1view=", body, flags=re.I)

src = re.sub(
    r"function\\s+openTrade\\s*\\([^)]*\\)\\s*\\{.*?\\}",
    rewrite_opentrade,
    src,
    flags=re.S | re.I,
)
src = re.sub(
    r"(['\\"])([^'\\"]*page=(?:history|calendar|calendrier)[^'\\"]*?)edit=",
    r"\\\\1\\\\2view=",
    src,
    flags=re.I,
)
path.write_text(src, encoding="utf-8")
print("patched")
`
  );
  execSync("python3 " + pyFile, { stdio: "inherit" });

  const patched = fs.readFileSync(journal, "utf8");
  assert(patched.includes("torinvest-journal-readonly-view"), "marker injected");
  assert(patched.includes("trading-journal-readonly-view.php"), "require injected");
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
echo defined('TORINVEST_TJ_READONLY') ? 'RO=1' : 'RO=0';
echo '|edit=' . ($_GET['edit'] ?? '');
echo '|mode=' . ($GLOBALS['TORINVEST_TJ_READONLY_MODE'] ?? '');
`
    );
    const out = execSync("php " + remapFile, { encoding: "utf8" });
    assert(out.includes("RO=1"), "readonly flag set for view=");
    assert(out.includes("edit=4"), "view remapped to edit for loader");
    assert(out.includes("mode=detail"), "detail mode");
    console.log("remap OK:", out.trim());

    const editFile = path.join(tmp, "edit.php");
    fs.writeFileSync(
      editFile,
      `<?php
$_GET = ['page' => 'history', 'edit' => '4'];
$_REQUEST = $_GET;
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
torinvest_journal_readonly_boot();
echo defined('TORINVEST_TJ_READONLY') ? 'RO=1' : 'RO=0';
echo '|mode=' . ($GLOBALS['TORINVEST_TJ_READONLY_MODE'] ?? '');
`
    );
    const out2 = execSync("php " + editFile, { encoding: "utf8" });
    assert(out2.includes("RO=0"), "edit= alone is NOT readonly");
    assert(out2.includes("mode=nav"), "nav mode for edit");
    console.log("edit-passthrough OK:", out2.trim());

    const obFile = path.join(tmp, "ob.php");
    fs.writeFileSync(
      obFile,
      `<?php
$GLOBALS['TORINVEST_TJ_READONLY_MODE'] = 'detail';
$GLOBALS['TORINVEST_TJ_READONLY_ID'] = '4';
require ${JSON.stringify(path.join(api, "trading-journal-readonly-view.php"))};
$html = '<!DOCTYPE html><html><body><h1>Modifier le trade #4</h1><form><input name="pair" value="EURUSD"><button type="submit">Enregistrer</button></form></body></html>';
echo torinvest_journal_readonly_ob_filter($html);
`
    );
    const html = execSync("php " + obFile, { encoding: "utf8" });
    assert(html.includes("torinvest-tj-readonly-ui"), "UI marker injected");
    assert(html.includes("Modifier"), "Modifier button");
    assert(html.includes("Retour"), "Retour button");
    assert(html.includes("lecture seule"), "lecture seule label");
    console.log("ob-filter OK");
  } else {
    console.log("PHP runtime tests skipped (no php binary)");
  }

  const hotfix = fs.readFileSync(HOTFIX, "utf8");
  assert(hotfix.includes("patch-trading-journal-readonly.sh"), "hotfix calls patch");
  assert(hotfix.includes("cursor/journal-trade-readonly-691a"), "branch ref");

  console.log("ALL PASS — journal trade readonly");
}

main();
