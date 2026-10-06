#!/usr/bin/env node
/**
 * Fixture checks for isAddTradePage / list / detail / SAFE MODE mount (tradeClickNuke).
 * Run: node deploy/vps/tests/test-jts-is-add-trade-page.js
 * Uses jsdom when available; otherwise installs temporarily.
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

  listEmptyUrlDashboard: `
<!DOCTYPE html><html><body>
<aside><a>Ajouter un trade</a></aside>
<main>
  <h1>Dashboard</h1>
  <div class="trades-list">
    <div class="trade" data-trade-id="3">EURUSD Long</div>
  </div>
</main>
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

const SRC_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "la-forge",
  "js",
  "forge-journal-trade-screens.js"
);

function loadWithJsdom(html, search) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html, {
    url: "https://example.test/journal-embed/" + (search || ""),
    runScripts: "outside-only",
  });
  return { window: dom.window, document: dom.window.document };
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function makeStorage() {
  const map = Object.create(null);
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null;
    },
    setItem(k, v) {
      map[k] = String(v);
    },
    removeItem(k) {
      delete map[k];
    },
  };
}

/** Load detectors only (strip auto-boot tail). */
function extractAndEvalDetectors(window, document, storage) {
  let src = fs.readFileSync(SRC_PATH, "utf8");
  src = src.replace(
    /if \(document\.readyState === "loading"\) \{[\s\S]*$/m,
    "window.__forgeJtsDetectors = getDetectors();\n})();"
  );
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
    sessionStorage: storage || makeStorage(),
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

/** Full boot (SAFE MODE) — keep timers inert so we control boot via exposed path. */
function runFullBoot(window, document, storage) {
  let src = fs.readFileSync(SRC_PATH, "utf8");
  src = src.replace(
    /if \(window\.__forgeJournalTradeScreens\) return;\s*window\.__forgeJournalTradeScreens = 1;/,
    "window.__forgeJournalTradeScreens = 1;"
  );
  // Neutralize delayed boots / MO noise; call boot once synchronously after IIFE
  src = src.replace(/setTimeout\(boot,\s*\d+\);/g, "/* no delayed boot in tests */");
  src = src.replace(
    /if \(typeof MutationObserver[\s\S]*?moInstance\.observe\([^;]+;[\s\S]*?\}/,
    "/* no MO in tests */"
  );
  src = src.replace(
    /window\.addEventListener\("hashchange"[\s\S]*?popstate"[\s\S]*?\}\);/,
    "/* no nav listeners in tests */"
  );
  // Expose boot for re-run after opt-in
  src = src.replace(
    /window\.__forgeJtsDetectors = getDetectors\(\);/,
    "window.__forgeJtsDetectors = getDetectors();\n      window.__forgeJtsBoot = boot;"
  );

  const timers = [];
  const sandbox = {
    window,
    document,
    location: window.location,
    console,
    setTimeout: (fn) => {
      if (typeof fn === "function") timers.push(fn);
      return timers.length;
    },
    clearTimeout: () => {},
    sessionStorage: storage || makeStorage(),
    fetch: async () => ({ ok: true, json: async () => ({ trades: [], trade: { images: [] } }) }),
    URL,
    Image: window.Image || function () {},
    MutationObserver: function () {
      this.observe = function () {};
      this.disconnect = function () {};
    },
  };
  Object.defineProperty(window, "sessionStorage", {
    value: sandbox.sessionStorage,
    configurable: true,
  });
  sandbox.window = window;
  sandbox.document = document;
  // Force readyState complete so IIFE calls boot() immediately
  Object.defineProperty(document, "readyState", {
    value: "complete",
    configurable: true,
  });
  vm.runInNewContext(src, sandbox);
  // Flush any sync-scheduled boots from scheduleBoot leftover
  while (timers.length) {
    const fn = timers.shift();
    try {
      fn();
    } catch (_) {}
  }
  return {
    detectors: window.__forgeJtsDetectors,
    boot: window.__forgeJtsBoot,
    storage: sandbox.sessionStorage,
  };
}

function forgeIds(document) {
  return {
    panel: !!document.getElementById("forge-jts-panel"),
    nav: !!document.getElementById("forge-jts-nav"),
    optin: !!document.getElementById("forge-jts-optin"),
    drawer: !!document.getElementById("forge-jts-drawer"),
    overlay: !!document.getElementById("forge-jts-overlay"),
    style: !!document.getElementById("forge-jts-style"),
  };
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
      expectOff: true,
    },
    {
      name: "list with only 1 trade → NOT add",
      html: FIXTURES.listOneTrade,
      search: "",
      expectAdd: false,
      expectList: true,
      expectOff: true,
    },
    {
      name: "page-wide form wrapping list → NOT add",
      html: FIXTURES.listPageWideForm,
      search: "",
      expectAdd: false,
      expectList: true,
      expectOff: true,
    },
    {
      name: "empty-url dashboard-ish → stay off",
      html: FIXTURES.listEmptyUrlDashboard,
      search: "",
      expectAdd: false,
      expectOff: true,
    },
    {
      name: "real add-trade form → IS add (not off)",
      html: FIXTURES.addTradeForm,
      search: "?action=add_trade",
      expectAdd: true,
      expectList: false,
      expectOff: false,
    },
    {
      name: "URL add_trade but no form → NOT add (fix2)",
      html: FIXTURES.addTradeUrlOnlyNoForm,
      search: "?action=add_trade",
      expectAdd: false,
      expectOff: true,
    },
    {
      name: "detail read → NOT add",
      html: FIXTURES.detailRead,
      search: "?action=view&id=1",
      expectAdd: false,
      expectDetail: true,
      expectOff: true,
    },
    {
      name: "detail edit Enregistrer only → NOT add",
      html: FIXTURES.detailEditEnregistrer,
      search: "?action=edit&id=1",
      expectAdd: false,
      expectOff: true,
    },
  ];

  let passed = 0;
  for (const c of cases) {
    const { window, document } = loader(c.html, c.search || "");
    window.__forgeJournalTradeScreens = 0;
    const storage = makeStorage();
    const d = extractAndEvalDetectors(window, document, storage);
    assert(d && typeof d.isAddTradePage === "function", c.name + ": detectors missing");
    assert(d.tradeClickNuke === true, c.name + ": tradeClickNuke flag missing");
    assert(d.safeMode === true, c.name + ": safeMode flag missing");
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
    if (c.expectOff != null) {
      const off = d.shouldStayCompletelyOff();
      assert(off === c.expectOff, c.name + ": off=" + off + " expected " + c.expectOff);
    }
    console.log("OK —", c.name);
    passed++;
  }

  // ---- Mount behavior (SAFE MODE) ----
  const mountCases = [
    {
      name: "MOUNT list → no panel/nav/optin/style",
      html: FIXTURES.listWithSidebarAndHeaders,
      search: "",
      expect: { panel: false, nav: false, optin: false, drawer: false, overlay: false, style: false },
    },
    {
      name: "MOUNT detail → no panel/nav/optin/style",
      html: FIXTURES.detailRead,
      search: "?action=view&id=1",
      expect: { panel: false, nav: false, optin: false, drawer: false, overlay: false, style: false },
    },
    {
      name: "MOUNT edit → no panel/nav/optin/style",
      html: FIXTURES.detailEditEnregistrer,
      search: "?action=edit&id=1",
      expect: { panel: false, nav: false, optin: false, drawer: false, overlay: false, style: false },
    },
    {
      name: "MOUNT add (no enable) → optin only, no panel/nav/style",
      html: FIXTURES.addTradeForm,
      search: "?action=add_trade",
      expect: { panel: false, nav: false, optin: true, drawer: false, overlay: false, style: false },
    },
  ];

  for (const c of mountCases) {
    const { window, document } = loader(c.html, c.search || "");
    window.__forgeJournalTradeScreens = 0;
    runFullBoot(window, document, makeStorage());
    const ids = forgeIds(document);
    for (const key of Object.keys(c.expect)) {
      assert(
        ids[key] === c.expect[key],
        c.name + ": " + key + "=" + ids[key] + " expected " + c.expect[key]
      );
    }
    console.log("OK —", c.name);
    passed++;
  }

  // Opt-in click → panel mounts
  {
    const { window, document } = loader(FIXTURES.addTradeForm, "?action=add_trade");
    window.__forgeJournalTradeScreens = 0;
    const storage = makeStorage();
    runFullBoot(window, document, storage);
    assert(document.getElementById("forge-jts-optin"), "optin should exist before click");
    assert(!document.getElementById("forge-jts-panel"), "panel must not exist before opt-in");
    const btn = document.querySelector("#forge-jts-optin button");
    assert(btn, "optin button missing");
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert(storage.getItem("forge_jts_screens_on") === "1", "enable key not set");
    assert(document.getElementById("forge-jts-panel"), "panel should mount after opt-in");
    assert(!document.getElementById("forge-jts-optin"), "optin should remove after enable");
    assert(document.getElementById("forge-jts-style"), "styles should load after opt-in");
    console.log("OK — MOUNT add + opt-in click → panel");
    passed++;
  }

  // Pre-seeded enable on list must still nuke (no leftover chrome)
  {
    const { window, document } = loader(FIXTURES.listWithSidebarAndHeaders, "");
    window.__forgeJournalTradeScreens = 0;
    const storage = makeStorage();
    storage.setItem("forge_jts_screens_on", "1");
    runFullBoot(window, document, storage);
    const ids = forgeIds(document);
    assert(!ids.panel && !ids.nav && !ids.optin && !ids.style, "list must nuke even if enable was set");
    assert(storage.getItem("forge_jts_screens_on") == null, "enable must clear on list");
    console.log("OK — MOUNT list clears stale enable + nukes UI");
    passed++;
  }

  console.log("\nAll", passed, "fixture checks passed (tradeClickNuke SAFE MODE).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
