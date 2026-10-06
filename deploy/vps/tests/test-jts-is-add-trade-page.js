#!/usr/bin/env node
/**
 * Fixture checks for isAddTradePage / list / detail detectors (tradeClickFix2).
 * Run: node deploy/vps/tests/test-jts-is-add-trade-page.js
 * Uses jsdom when available; otherwise a minimal DOM stub sufficient for these fixtures.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FIXTURES = {
  listWithSidebarAndHeaders: `
<!DOCTYPE html><html><body>
<aside class="sidebar">
  <a href="?action=add_trade">Ajouter un trade</a>
  <a href="?action=list">Trades</a>
</aside>
<main>
  <h1>Trades</h1>
  <table>
    <thead><tr><th>Date</th><th>Actif</th><th>Direction</th><th>Prix d'entrée</th><th>PnL</th></tr></thead>
    <tbody>
      <tr data-trade-id="1" onclick="openTrade(1)"><td>2026-01-01</td><td>EURUSD</td><td>Long</td><td>1.08</td><td>+10</td></tr>
      <tr data-trade-id="2"><td>2026-01-02</td><td>XAUUSD</td><td>Short</td><td>2000</td><td>-5</td></tr>
    </tbody>
  </table>
</main>
</body></html>`,

  listOneTrade: `
<!DOCTYPE html><html><body>
<nav><a>Ajouter un trade</a></nav>
<main>
  <h1>Mes trades</h1>
  <table>
    <thead><tr><th>Actif</th><th>Direction</th><th>Date</th></tr></thead>
    <tbody>
      <tr class="trade-row"><td>BTCUSD</td><td>Long</td><td>2026-03-01</td></tr>
    </tbody>
  </table>
</main>
</body></html>`,

  listPageWideForm: `
<!DOCTYPE html><html><body>
<form id="wrap">
  <aside><a>Ajouter un trade</a></aside>
  <main>
    <h1>Journal</h1>
    <table>
      <thead><tr><th>Actif</th><th>Direction</th><th>Prix d'entrée</th></tr></thead>
      <tbody>
        <tr data-trade-id="9"><td>NAS100</td><td>Long</td><td>15000</td></tr>
      </tbody>
    </table>
    <button type="submit">Filtrer</button>
  </main>
</form>
</body></html>`,

  addTradeForm: `
<!DOCTYPE html><html><body>
<aside><a href="?list">Trades</a><a>Ajouter un trade</a></aside>
<main>
  <h1>Ajouter un trade</h1>
  <form id="add">
    <label for="actif">Actif</label>
    <input id="actif" name="pair" value="" />
    <label for="dir">Direction</label>
    <select id="dir" name="direction"><option>Long</option><option>Short</option></select>
    <label for="entry">Prix d'entrée</label>
    <input id="entry" name="entry" type="text" />
    <label for="notes">Notes</label>
    <textarea id="notes"></textarea>
    <button type="submit">Ajouter</button>
  </form>
</main>
</body></html>`,

  addTradeUrlOnlyNoForm: `
<!DOCTYPE html><html><body>
<aside><a>Ajouter un trade</a></aside>
<main>
  <h1>Dashboard</h1>
  <p>Pas de formulaire</p>
</main>
</body></html>`,

  detailRead: `
<!DOCTYPE html><html><body>
<main>
  <h1>Détail du trade</h1>
  <p>Actif: EURUSD</p>
  <p>Direction: Long</p>
  <p>Prix d'entrée: 1.085</p>
  <a href="?action=list">Retour</a>
  <button type="button">Modifier</button>
</main>
</body></html>`,

  detailEditEnregistrer: `
<!DOCTYPE html><html><body>
<main>
  <h1>Modifier le trade</h1>
  <form>
    <label for="actif">Actif</label>
    <input id="actif" name="pair" value="EURUSD" />
    <label for="dir">Direction</label>
    <select id="dir" name="direction"><option selected>Long</option></select>
    <label for="entry">Prix d'entrée</label>
    <input id="entry" name="entry" value="1.08" />
    <button type="submit">Enregistrer</button>
    <a href="?action=list">Retour</a>
  </form>
</main>
</body></html>`,
};

function loadWithJsdom(html, search) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html, { url: "https://example.test/journal-embed/" + (search || "") });
  return { window: dom.window, document: dom.window.document };
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function extractAndEvalDetectors(window, document) {
  const srcPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "la-forge",
    "js",
    "forge-journal-trade-screens.js"
  );
  let src = fs.readFileSync(srcPath, "utf8");
  // Prevent auto-boot side effects; expose detectors after IIFE
  src = src.replace(
    /if \(document\.readyState === "loading"\) \{[\s\S]*$/m,
    "window.__forgeJtsDetectors = getDetectors();\n})();"
  );
  // Allow re-entry in tests
  src = src.replace(
    /if \(window\.__forgeJournalTradeScreens\) return;\s*window\.__forgeJournalTradeScreens = 1;/,
    "window.__forgeJournalTradeScreens = 1;"
  );
  const sandbox = {
    window,
    document,
    location: window.location,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URL,
    Image: window.Image || function () {},
    MutationObserver: window.MutationObserver || function () {
      this.observe = function () {};
    },
  };
  sandbox.window = window;
  sandbox.document = document;
  vm.runInNewContext(src, sandbox);
  return window.__forgeJtsDetectors || sandbox.window.__forgeJtsDetectors;
}

async function main() {
  let loader;
  try {
    require.resolve("jsdom");
    loader = loadWithJsdom;
    console.log("using jsdom");
  } catch (_) {
    console.log("jsdom not installed — installing temporarily in /tmp…");
    const { execSync } = require("child_process");
    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "jts-test-"));
    execSync("npm init -y && npm install jsdom@24", {
      cwd: tmp,
      stdio: "inherit",
    });
    module.paths.unshift(path.join(tmp, "node_modules"));
    loader = loadWithJsdom;
  }

  const cases = [
    {
      name: "list with sidebar + headers (2 rows) → NOT add",
      html: FIXTURES.listWithSidebarAndHeaders,
      search: "",
      expectAdd: false,
      expectList: true,
    },
    {
      name: "list with only 1 trade → NOT add",
      html: FIXTURES.listOneTrade,
      search: "",
      expectAdd: false,
      expectList: true,
    },
    {
      name: "page-wide form wrapping list → NOT add",
      html: FIXTURES.listPageWideForm,
      search: "",
      expectAdd: false,
      expectList: true,
    },
    {
      name: "real add-trade form → IS add",
      html: FIXTURES.addTradeForm,
      search: "?action=add_trade",
      expectAdd: true,
      expectList: false,
    },
    {
      name: "URL add_trade but no form → NOT add (fix2)",
      html: FIXTURES.addTradeUrlOnlyNoForm,
      search: "?action=add_trade",
      expectAdd: false,
    },
    {
      name: "detail read → NOT add",
      html: FIXTURES.detailRead,
      search: "?action=view&id=1",
      expectAdd: false,
      expectDetail: true,
    },
    {
      name: "detail edit Enregistrer only → NOT add",
      html: FIXTURES.detailEditEnregistrer,
      search: "?action=edit&id=1",
      expectAdd: false,
    },
  ];

  let passed = 0;
  for (const c of cases) {
    const { window, document } = loader(c.html, c.search || "");
    // Reset singleton so script can run per fixture
    window.__forgeJournalTradeScreens = 0;
    const d = extractAndEvalDetectors(window, document);
    assert(d && typeof d.isAddTradePage === "function", c.name + ": detectors missing");
    const isAdd = d.isAddTradePage();
    assert(isAdd === c.expectAdd, c.name + ": isAddTradePage=" + isAdd + " expected " + c.expectAdd);
    if (c.expectList != null) {
      const isList = d.looksLikeTradeListPage(document.body);
      assert(isList === c.expectList, c.name + ": list=" + isList + " expected " + c.expectList);
    }
    if (c.expectDetail != null) {
      const isDetail = d.looksLikeTradeDetailPage(document.body);
      assert(
        isDetail === c.expectDetail,
        c.name + ": detail=" + isDetail + " expected " + c.expectDetail
      );
    }
    console.log("OK —", c.name);
    passed++;
  }
  console.log("\nAll", passed, "fixture checks passed (tradeClickFix2).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
