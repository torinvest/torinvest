/**
 * Pont La Forge Premium → Trading Journal Pro (PHP radar).
 * Proxy same-origin robuste : query, POST body, redirects, rewrite HTML/JS.
 */
"use strict";

const express = require("express");
const crypto = require("crypto");

function radarBaseUrl() {
  const explicit = String(
    process.env.FORGE_JOURNAL_RADAR_URL ||
      process.env.FORGE_FONDAMENTAL_RADAR_URL ||
      process.env.FORGE_RADAR_URL ||
      ""
  ).replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://radar.torinvest-trading.com";
}

function journalPhpPath() {
  return String(process.env.FORGE_JOURNAL_PHP_PATH || "/trading_journal.php");
}

function bridgeSecret() {
  return String(
    process.env.FORGE_JOURNAL_BRIDGE_SECRET ||
      process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
      process.env.AI_ACCESS_HMAC_SECRET ||
      ""
  );
}

function radarHostHeader(baseUrl) {
  try {
    const u = new URL(baseUrl);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      return process.env.FORGE_JOURNAL_RADAR_HOST || "radar.torinvest-trading.com";
    }
    return u.hostname;
  } catch (_) {
    return "radar.torinvest-trading.com";
  }
}

function radarFetchHeaders(baseUrl, extra) {
  const headers = { ...(extra || {}) };
  const host = radarHostHeader(baseUrl);
  if (host) headers.Host = host;
  return headers;
}

function isPremiumSessionUser(user) {
  if (!user?.email) return false;
  if (user.isAdmin === true || user.role === "admin") return true;
  if (user.subscribed === true || user.subscribed === 1 || user.subscribed === "true") {
    return true;
  }
  const plan = String(user.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function premiumUser(req) {
  const s = req.session;
  if (!s) return null;
  const user = s.user || req.user;
  if (isPremiumSessionUser(user)) return user;
  const email = String(user?.email || s.email || "").trim();
  if (!email) return null;
  const synthetic = {
    email,
    subscribed: user?.subscribed ?? s.subscribed,
    plan: user?.plan ?? s.plan,
    name: user?.name ?? s.name,
  };
  return isPremiumSessionUser(synthetic) ? synthetic : null;
}

async function premiumUserViaMe(req) {
  const cookie = String(req.headers.cookie || "");
  if (!cookie) return null;
  const port = Number(process.env.PORT || 3001);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/me`, {
      headers: { cookie, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json().catch(() => ({}));
    const me = data.user && typeof data.user === "object" ? data.user : data;
    if (!me?.email) return null;
    if (isPremiumSessionUser(me)) return me;
  } catch (_) {
    /* ignore */
  }
  return null;
}

async function requirePremium(req) {
  let user = premiumUser(req);
  if (!user) user = await premiumUserViaMe(req);
  return user;
}

const PHPSESS_COOKIE = "forge_tj_phpsessid";
const EMBED_PATH = "/journal-embed/";

function readReqCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  const re = new RegExp(
    "(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"
  );
  const m = raw.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePhpSessid(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    if (!raw) continue;
    const m = String(raw).match(/PHPSESSID=([^;]+)/i);
    if (m) return m[1];
  }
  return null;
}

function looksLikeLoginPage(html) {
  const h = String(html || "");
  return (
    /name=["']login_action["']/i.test(h) ||
    (/Trading Journal Pro/i.test(h) &&
      /name=["']password["']/i.test(h) &&
      /name=["']username["']/i.test(h))
  );
}

function makeSsoToken(email) {
  const secret = bridgeSecret();
  if (!secret || !email) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const payload = JSON.stringify({
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString("hex"),
    role: "client",
    meta: { source: "forge_journal_sso", email: String(email || "").trim() },
  });
  const b64 = Buffer.from(payload)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

function storePhpSess(req, res, newSess) {
  if (!newSess) return;
  if (req.session) req.session.tjPhpSessid = newSess;
  res.cookie(PHPSESS_COOKIE, newSess, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

function clientQueryString(req) {
  const i = String(req.originalUrl || "").indexOf("?");
  if (i < 0) return "";
  return String(req.originalUrl).slice(i + 1);
}

function buildUpstreamUrl(req, ssoToken) {
  const u = new URL(radarBaseUrl() + journalPhpPath());
  const qs = clientQueryString(req);
  if (qs) {
    const extra = new URLSearchParams(qs);
    for (const [k, v] of extra.entries()) {
      if (k === "forge_sso") continue;
      u.searchParams.append(k, v);
    }
  }
  if (ssoToken) u.searchParams.set("forge_sso", ssoToken);
  return u.toString();
}

function mapRedirectToEmbed(location) {
  if (!location) return EMBED_PATH;
  const loc = String(location).trim();

  if (loc.startsWith("?")) {
    return "/journal-embed/" + loc;
  }
  if (loc.startsWith("/?")) {
    return "/journal-embed/" + loc.slice(1);
  }

  try {
    const abs = new URL(loc, radarBaseUrl());
    const isRadar = /radar\.torinvest-trading\.com$/i.test(abs.hostname);
    const isApp = /app\.torinvest-trading\.com$/i.test(abs.hostname);
    const isWww = /^(?:www\.)?torinvest-trading\.com$/i.test(abs.hostname);
    const isJournalPhp = /trading_journal\.php$/i.test(abs.pathname);
    const isRoot = abs.pathname === "/" || abs.pathname === "";

    // TJ PHP anywhere → embed
    if (isJournalPhp || /trading_journal\.php/i.test(loc)) {
      return "/journal-embed/" + (abs.search || "");
    }
    // Radar root (login/menu redirects) → embed — never leave user on radar MAIN SITE HTML
    if (isRadar && isRoot) {
      return "/journal-embed/" + (abs.search || "");
    }
    // app.* root + query (iframe breakout residue)
    if (isApp && isRoot && abs.search) {
      return "/journal-embed/" + abs.search;
    }
    // www only for explicit journal PHP (already handled) — skip marketing URLs
    if (isWww && isJournalPhp) {
      return "/journal-embed/" + (abs.search || "");
    }
  } catch (_) {
    /* ignore */
  }

  if (/trading_journal\.php/i.test(loc)) {
    const q = loc.includes("?") ? loc.slice(loc.indexOf("?")) : "";
    return "/journal-embed/" + q;
  }

  return null;
}

/**
 * Screens script HARD OFF — never inject forge-journal-trade-screens.js into TJ HTML.
 * (Env JOURNAL_TRADE_SCREENS kept for ping/API only; inject path deleted.)
 */
function tradeScreensInjectEnabled() {
  // Inject permanently disabled — click→detail must use native TJ onclick handlers.
  return false;
}

/**
 * NUCLEAR: strip Content-Security-Policy entirely for /journal-embed/*.
 * Helmet on app.* historically set script-src-attr 'none' (blocks onclick=openTrade).
 * Radar itself has no CSP — match that. Also block later setHeader("CSP", …).
 */
function applyJournalEmbedCsp(res) {
  try {
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("Content-Security-Policy-Report-Only");
  } catch (_) {
    /* ignore */
  }
  if (res.__tjCspStripped) return;
  res.__tjCspStripped = true;
  const origSet = res.setHeader.bind(res);
  res.setHeader = function (name, value) {
    if (/^Content-Security-Policy/i.test(String(name || ""))) return res;
    return origSet(name, value);
  };
  const origAppend = res.appendHeader ? res.appendHeader.bind(res) : null;
  if (origAppend) {
    res.appendHeader = function (name, value) {
      if (/^Content-Security-Policy/i.test(String(name || ""))) return res;
      return origAppend(name, value);
    };
  }
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function () {
    try {
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("Content-Security-Policy-Report-Only");
    } catch (_) {
      /* ignore */
    }
    return origWriteHead.apply(res, arguments);
  };
}

function absolutizeRadarAssets(html) {
  const base = radarBaseUrl().replace(/\/$/, "");
  const assetExt =
    /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp[34]|webm|json)(?:\?|#|$)/i;
  let out = String(html || "");

  // CRITICAL v15: menu links href="?view=calendrier|historique|…" must stay in embed.
  // v14 wrongly rewrote them to https://radar.torinvest-trading.com/?… (sortie → site principal).
  // Also catch href="/?…" which would resolve to app.* root (landing « old site »).
  out = out.replace(/\bhref=(["'])\?([^"']*)\1/gi, 'href="/journal-embed/?$2"');
  out = out.replace(/\bhref=(["'])\/\?([^"']*)\1/gi, 'href="/journal-embed/?$2"');
  out = out.replace(/\baction=(["'])\?([^"']*)\1/gi, 'action="/journal-embed/?$2"');
  out = out.replace(/\baction=(["'])\/\?([^"']*)\1/gi, 'action="/journal-embed/?$2"');

  // Root-relative assets → radar (JS/CSS/img). Never rewrite non-asset href menus to radar.
  out = out.replace(
    /\b(src|href)=(["'])\/(?!\/|journal-embed\/)([^"']*)\2/gi,
    (m, attr, q, path) => {
      if (/^trading_journal\.php/i.test(path)) return m;
      if (path.startsWith("?")) return m;
      if (String(attr).toLowerCase() === "href" && !assetExt.test(path)) return m;
      return attr + "=" + q + base + "/" + path + q;
    }
  );

  // Relative paths: ONLY static assets → radar. Leave menu words / php for shim fix().
  out = out.replace(
    /\b(src|href)=(["'])(?!https?:|\/\/|\/|\?|#|data:|blob:|javascript:|mailto:)([^"']+)\2/gi,
    (m, attr, q, path) => {
      if (/^trading_journal\.php/i.test(path)) return m;
      const clean = path.replace(/^\.\//, "");
      if (!assetExt.test(clean)) return m;
      return attr + "=" + q + base + "/" + clean + q;
    }
  );
  return out;
}

function injectProxyShim(html) {
  // HARD DELETE: never emit <script src=...forge-journal-trade-screens...>
  // v13: top/parent.location keep-in-frame + nuclear trade-row click fallback
  const screens = "<!-- forge-jts:injectHardOff navFix v16 ssoDirect -->";
  const shim = `<script>(function(){
  if (window.__tjForgeProxyShim) return; window.__tjForgeProxyShim = 1;
  window.__tjForgeHrefClickFix = 1;
  window.__tjForgeClickEverywhere = 1;
  window.__tjForgeCspStrip = 1;
  window.__tjForgeNavFix = 16;
  window.__tjSsoDirect = true;
  window.__tjForgeBridgeVersion = 16;
  var P = "/journal-embed/";
  var _lastGo = 0;
  function fix(u){
    if (u == null) return u;
    if (typeof u !== "string") {
      try { u = String(u); } catch(e){ return u; }
    }
    var s = u.trim();
    if (!s) return u;
    // Menu query-only (?view=historique) must stay on embed — never radar/www/app root
    if (s.charAt(0) === "?") return P + s;
    if (/^\\/\\?/.test(s)) return P + s.slice(1);
    if (/^https?:\\/\\/radar\\.torinvest-trading\\.com\\/trading_journal\\.php/i.test(s)) {
      var q = s.indexOf("?"); return P + (q>=0 ? s.slice(q) : "");
    }
    if (/^\\/?trading_journal\\.php/i.test(s)) {
      var q2 = s.indexOf("?"); return P + (q2>=0 ? s.slice(q2) : "");
    }
    try {
      if (/^https?:\\/\\/app\\.torinvest-trading\\.com\\/trading_journal\\.php/i.test(s)) {
        var q3 = s.indexOf("?"); return P + (q3>=0 ? s.slice(q3) : "");
      }
      // v14 bug residue: radar root + query (menu wrongly absolutized → MAIN SITE HTML)
      if (/^https?:\\/\\/radar\\.torinvest-trading\\.com\\/?\\?/i.test(s)) {
        var q4 = s.indexOf("?"); return P + (q4>=0 ? s.slice(q4) : "");
      }
      // app.* root + query (target=_top breakout resolved against parent)
      if (/^https?:\\/\\/app\\.torinvest-trading\\.com\\/?\\?/i.test(s)) {
        var q6 = s.indexOf("?"); return P + (q6>=0 ? s.slice(q6) : "");
      }
      // Principal/www journal links → embed
      if (/^https?:\\/\\/(?:www\\.)?torinvest-trading\\.com\\/trading_journal\\.php/i.test(s)) {
        var q5 = s.indexOf("?"); return P + (q5>=0 ? s.slice(q5) : "");
      }
      // www/principal root + journal-ish query (page|view|action|id)
      if (/^https?:\\/\\/(?:www\\.)?torinvest-trading\\.com\\/?\\?(?:[^#]*\\b(?:page|view|action|id)=)/i.test(s)) {
        var q7 = s.indexOf("?"); return P + (q7>=0 ? s.slice(q7) : "");
      }
    } catch(e){}
    return u;
  }
  function isJournalNav(u){
    var s = String(u || "");
    return /\\/journal-embed\\/?|trading_journal\\.php|^\\?|^\\/\\?/.test(s)
      || /radar\\.torinvest-trading\\.com\\/?\\?/i.test(s)
      || /torinvest-trading\\.com\\/trading_journal/i.test(s);
  }
  function patchLoc(loc, keepInFrame){
    if (!loc) return;
    try {
      var oAssign = loc.assign.bind(loc);
      loc.assign = function(u){
        var fixed = fix(String(u));
        if (keepInFrame && isJournalNav(fixed)) {
          return window.location.assign(fixed);
        }
        return oAssign(fixed);
      };
      var oReplace = loc.replace.bind(loc);
      loc.replace = function(u){
        var fixed = fix(String(u));
        if (keepInFrame && isJournalNav(fixed)) {
          return window.location.replace(fixed);
        }
        return oReplace(fixed);
      };
    } catch(e){}
    try {
      var hrefDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(loc), "href")
        || Object.getOwnPropertyDescriptor(Location.prototype, "href");
      if (hrefDesc && hrefDesc.set && hrefDesc.get) {
        Object.defineProperty(loc, "href", {
          configurable: true,
          enumerable: true,
          get: function(){ return hrefDesc.get.call(loc); },
          set: function(u){
            var fixed = fix(String(u));
            if (keepInFrame && isJournalNav(fixed)) {
              window.location.href = fixed;
              return;
            }
            hrefDesc.set.call(loc, fixed);
          }
        });
      }
    } catch(e){}
  }
  document.addEventListener("submit", function(e){
    var f = e.target; if (!f || !f.action) return;
    var a = fix(f.getAttribute("action") || f.action);
    if (a && a !== f.action) f.action = a;
  }, true);
  var ofetch = window.fetch;
  if (ofetch) {
    window.fetch = function(input, init){
      if (typeof input === "string") input = fix(input);
      else if (input && typeof input.url === "string") {
        try { input = new Request(fix(input.url), input); } catch(e){}
      }
      return ofetch.call(this, input, init);
    };
  }
  var oOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url){
    arguments[1] = fix(url);
    return oOpen.apply(this, arguments);
  };
  try {
    var oAssign = Location.prototype.assign;
    Location.prototype.assign = function(u){ return oAssign.call(this, fix(String(u))); };
    var oReplace = Location.prototype.replace;
    Location.prototype.replace = function(u){ return oReplace.call(this, fix(String(u))); };
  } catch(e){}
  try {
    var hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, "href");
    if (hrefDesc && hrefDesc.set && hrefDesc.get) {
      Object.defineProperty(Location.prototype, "href", {
        configurable: true,
        enumerable: true,
        get: function(){ return hrefDesc.get.call(this); },
        set: function(u){ hrefDesc.set.call(this, fix(String(u))); }
      });
    }
  } catch(e){}
  try { patchLoc(window.location, false); } catch(e){}
  try { if (window.top && window.top !== window) patchLoc(window.top.location, true); } catch(e){}
  try { if (window.parent && window.parent !== window) patchLoc(window.parent.location, true); } catch(e){}
  try {
    var oWinOpen = window.open;
    if (oWinOpen) {
      window.open = function(u, n, f){ return oWinOpen.call(this, fix(String(u||"")), n, f); };
    }
  } catch(e){}
  // Fix <a href> — keep menu inside iframe (never stopPropagation)
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href) || /^mailto:/i.test(href)) return;
    var tg0 = (a.getAttribute("target") || "").toLowerCase();
    var breakout = tg0 === "_top" || tg0 === "_parent";
    var fixed = fix(href);
    if (fixed && fixed !== href) a.setAttribute("href", fixed);
    var dest = fixed || href;
    var journal = isJournalNav(dest) || isJournalNav(href);
    if (!journal) return;
    a.setAttribute("target", "_self");
    try { a.removeAttribute("formtarget"); } catch(err){}
    // Ruthless: breakout attrs OR absolute radar/www/app root query → navigate in-frame only
    if (breakout ||
        /^https?:\\/\\/(?:radar\\.|www\\.|app\\.)?torinvest-trading\\.com\\/?\\?/i.test(href) ||
        /^https?:\\/\\/radar\\.torinvest-trading\\.com\\/trading_journal/i.test(href) ||
        (fixed && fixed !== href && fixed.indexOf(P) === 0)) {
      e.preventDefault();
      try { window.location.assign(dest); } catch(err2){ window.location.href = dest; }
    }
  }, true);

  function tradeIdFromEl(el){
    if (!el || !el.getAttribute) return null;
    var id = el.getAttribute("data-trade-id") || el.getAttribute("data-id") || el.getAttribute("data-trade");
    if (id != null && String(id).trim() !== "" && /^\\d+$/.test(String(id).trim())) return String(id).trim();
    var oc = el.getAttribute("onclick") || "";
    var m = oc.match(/openTrade\\s*\\(\\s*['\"]?(\\d+)/i);
    return m ? m[1] : null;
  }
  function goTrade(id){
    if (id == null || id === "") return;
    id = String(id).trim();
    var now = Date.now();
    if (now - _lastGo < 250) return;
    _lastGo = now;
    if (typeof window.openTrade === "function") {
      try { window.openTrade(id); return; } catch(e){}
    }
    var dest = P + "?action=view&id=" + encodeURIComponent(id);
    try { window.location.assign(dest); } catch(e2){ window.location.href = dest; }
  }
  function wrapOpenTrade(){
    var o = window.openTrade;
    if (typeof o !== "function" || o.__tjWrapped) return;
    window.openTrade = function(id){
      try { return o.apply(this, arguments); }
      catch(e){
        var dest = P + "?action=view&id=" + encodeURIComponent(String(id));
        try { window.location.assign(dest); } catch(e2){ window.location.href = dest; }
      }
    };
    window.openTrade.__tjWrapped = 1;
  }
  function isTradeRow(el){
    if (!el || !el.getAttribute) return false;
    if (el.getAttribute("data-trade-id")) return true;
    var oc = el.getAttribute("onclick") || "";
    if (/openTrade\\s*\\(/i.test(oc)) return true;
    if (el.classList && (el.classList.contains("trade-row") || el.classList.contains("cal-trade"))) return true;
    return false;
  }
  function armRows(root){
    if (!root || !root.querySelectorAll) return;
    var sel = "[data-trade-id], tr[onclick*=openTrade], [onclick*=openTrade], .trade-row, .cal-trade, .calendar-day [data-id], .cal-day [data-trade-id]";
    var nodes = root.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++){
      var n = nodes[i];
      if (n.__tjArm) continue;
      if (!isTradeRow(n) && !n.getAttribute("data-trade-id") && !(n.getAttribute("onclick")||"").match(/openTrade/i)) continue;
      n.__tjArm = 1;
      // Leave existing onclick; bubble backup if CSP blocked it or openTrade missing
      n.addEventListener("click", function(ev){
        var t = ev.target;
        if (t && t.closest) {
          var ctrl = t.closest("button, a[href], input, select, textarea");
          if (ctrl && ctrl !== this) {
            var coc = (ctrl.getAttribute && ctrl.getAttribute("onclick")) || "";
            if (coc.indexOf("openTrade") < 0 && !ctrl.getAttribute("data-trade-id")) return;
          }
        }
        var id = tradeIdFromEl(this);
        if (!id) return;
        var hasOc = /openTrade\\s*\\(/i.test(this.getAttribute("onclick") || "");
        if (hasOc && typeof window.openTrade === "function") {
          var before = String(location.href);
          setTimeout(function(){
            if (String(location.href) === before) goTrade(id);
          }, 60);
          return;
        }
        goTrade(id);
      }, false);
    }
  }
  function bootArm(){
    wrapOpenTrade();
    armRows(document);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootArm);
  else bootArm();
  try {
    var mo = new MutationObserver(function(){
      wrapOpenTrade();
      armRows(document);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e){}
  // Document bubble (list + calendar) — NO stopPropagation
  document.addEventListener("click", function(e){
    var el = e.target && e.target.closest
      ? e.target.closest("[data-trade-id], tr[onclick*=\\"openTrade\\"], [onclick*=\\"openTrade\\"], .trade-row, .cal-trade")
      : null;
    if (!el) return;
    var t = e.target;
    if (t && t.closest) {
      var ctrl = t.closest("button, a[href], input, select, textarea");
      if (ctrl && ctrl !== el) {
        var coc = (ctrl.getAttribute && ctrl.getAttribute("onclick")) || "";
        if (coc.indexOf("openTrade") < 0 && !ctrl.getAttribute("data-trade-id")) return;
      }
    }
    var id = tradeIdFromEl(el);
    if (!id) return;
    var hasOc = /openTrade\\s*\\(/i.test(el.getAttribute("onclick") || "");
    if (hasOc && typeof window.openTrade === "function") {
      var before = String(location.href);
      setTimeout(function(){
        if (String(location.href) === before) goTrade(id);
      }, 60);
      return;
    }
    goTrade(id);
  }, false);
})();</script>`;
  const inject = shim + screens;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, inject + "</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, "<body$1>" + inject);
  return inject + html;
}

function rewriteJournalHtml(html) {
  let out = absolutizeRadarAssets(String(html));
  const radar = radarBaseUrl().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Strip any meta http-equiv CSP (Helmet is not the only vector)
  out = out.replace(
    /<meta[^>]+http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi,
    ""
  );
  out = out.replace(
    /<meta[^>]+http-equiv\s*=\s*["']Content-Security-Policy-Report-Only["'][^>]*>/gi,
    ""
  );

  out = out.replace(
    new RegExp(`https?:\\/\\/${radar.replace(/\\\//g, "/")}\\/trading_journal\\.php`, "gi"),
    "/journal-embed/"
  );
  // simpler absolute replace
  out = out.replace(
    /https?:\/\/radar\.torinvest-trading\.com\/trading_journal\.php/gi,
    "/journal-embed/"
  );
  // Radar/www ROOT + query (v14 absolutize residue or absolute menu) → embed — NOT main site
  out = out.replace(
    /https?:\/\/radar\.torinvest-trading\.com\/?\?/gi,
    "/journal-embed/?"
  );
  out = out.replace(
    /https?:\/\/(?:www\.)?torinvest-trading\.com\/trading_journal\.php/gi,
    "/journal-embed/"
  );
  // JS string literals: location.href = "trading_journal.php?..."
  out = out.replace(
    /(['"`])\/?trading_journal\.php/gi,
    "$1/journal-embed/"
  );
  out = out.replace(
    /(<form[^>]*\saction=["'])\/?trading_journal\.php([^"']*)(["'][^>]*>)/gi,
    "$1/journal-embed/$2$3"
  );
  out = out.replace(/(<form)((?![^>]*\saction=)[^>]*>)/gi, '$1 action="/journal-embed/"$2');
  out = out.replace(
    /href=(["'])\/?trading_journal\.php([^"']*)\1/gi,
    'href="/journal-embed/$2"'
  );
  out = out.replace(
    /action=(["'])\/?trading_journal\.php([^"']*)\1/gi,
    'action="/journal-embed/$2"'
  );
  // Strip target=_top/_parent on journal-embed anchors (iframe breakout → principal site)
  out = out.replace(
    /(<a\b[^>]*\bhref=["']\/journal-embed\/[^"']*["'][^>]*?)\s+target=["']_(?:top|parent)["']/gi,
    '$1 target="_self"'
  );
  out = out.replace(
    /(<a\b[^>]*?)\s+target=["']_(?:top|parent)["']([^>]*\bhref=["']\/journal-embed\/[^"']*["'])/gi,
    '$1 target="_self"$2'
  );

  return injectProxyShim(out);
}

async function upstreamFetch(target, method, headers, body) {
  const upstream = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
  });
  let newSess = null;
  if (typeof upstream.headers.getSetCookie === "function") {
    newSess = parsePhpSessid(upstream.headers.getSetCookie());
  }
  if (!newSess) newSess = parsePhpSessid(upstream.headers.get("set-cookie"));
  const buf = Buffer.from(await upstream.arrayBuffer());
  const ctype = String(upstream.headers.get("content-type") || "text/html; charset=utf-8");
  return { upstream, newSess, buf, ctype };
}

async function tryEnvAutoLogin(target, baseHeaders, phpSess) {
  const user = String(process.env.FORGE_JOURNAL_USER || process.env.TJ_USER || "").trim();
  const pass = String(process.env.FORGE_JOURNAL_PASSWORD || process.env.TJ_PASSWORD || "");
  if (!user || !pass) return null;
  const headers = { ...baseHeaders };
  headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (phpSess) headers.Cookie = "PHPSESSID=" + phpSess;
  const body = new URLSearchParams({
    login_action: "1",
    username: user,
    password: pass,
  }).toString();
  return upstreamFetch(target, "POST", headers, body);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === "string") return resolve(Buffer.from(req.body));
    // already parsed object — re-encode
    if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
      const ctype = String(req.headers["content-type"] || "");
      if (ctype.includes("application/json")) {
        return resolve(Buffer.from(JSON.stringify(req.body)));
      }
      return resolve(
        Buffer.from(
          new URLSearchParams(
            Object.entries(req.body).map(([k, v]) => [k, v == null ? "" : String(v)])
          ).toString()
        )
      );
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createPhpProxy() {
  return async function phpProxy(req, res) {
    applyJournalEmbedCsp(res);

    const user = await requirePremium(req);
    if (!user?.email) {
      res.status(403);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      applyJournalEmbedCsp(res);
      return res.send(
        "<!doctype html><html lang=fr><body style='font-family:system-ui;padding:2rem'>" +
          "<p>Session La Forge Premium requise.</p>" +
          "<p><a href='/login.html?next=%2Fjournal.html'>Connexion</a></p>" +
          "</body></html>"
      );
    }

    let phpSess =
      (req.session && req.session.tjPhpSessid) || readReqCookie(req, PHPSESS_COOKIE) || "";

    const method = (req.method || "GET").toUpperCase();
    const sso = makeSsoToken(user.email);
    const target = buildUpstreamUrl(req, method === "GET" || method === "HEAD" ? sso : null);

    const upstreamHeaders = radarFetchHeaders(radarBaseUrl(), {
      Accept: req.headers.accept || "text/html,application/xhtml+xml,application/json,*/*",
      "User-Agent": req.headers["user-agent"] || "TorInvest-Journal-Proxy",
    });
    if (sso) upstreamHeaders["X-Forge-Journal-Sso"] = sso;
    if (phpSess) upstreamHeaders.Cookie = "PHPSESSID=" + phpSess;

    let body;
    if (method !== "GET" && method !== "HEAD") {
      const ctype = String(req.headers["content-type"] || "application/x-www-form-urlencoded");
      upstreamHeaders["Content-Type"] = ctype;
      try {
        body = await readRawBody(req);
        if (body && body.length) {
          upstreamHeaders["Content-Length"] = String(body.length);
        }
      } catch (e) {
        body = undefined;
      }
      // POST also needs SSO in query for session refresh
      if (sso) {
        const u = new URL(target);
        u.searchParams.set("forge_sso", sso);
        // rebuild — buildUpstreamUrl already used; add sso for POST
      }
    }

    let finalTarget = target;
    if (sso && method !== "GET" && method !== "HEAD") {
      const u = new URL(radarBaseUrl() + journalPhpPath());
      const qs = clientQueryString(req);
      if (qs) {
        const extra = new URLSearchParams(qs);
        for (const [k, v] of extra.entries()) {
          if (k !== "forge_sso") u.searchParams.append(k, v);
        }
      }
      u.searchParams.set("forge_sso", sso);
      finalTarget = u.toString();
    }

    try {
      let result = await upstreamFetch(finalTarget, method, upstreamHeaders, body);
      storePhpSess(req, res, result.newSess);
      if (result.newSess) phpSess = result.newSess;

      if (result.upstream.status >= 300 && result.upstream.status < 400) {
        const loc = result.upstream.headers.get("location") || "";
        const mapped = mapRedirectToEmbed(loc);
        if (mapped) {
          applyJournalEmbedCsp(res);
          res.redirect(302, mapped.replace(/([^:]\/)\/+/g, "$1"));
          return;
        }
      }

      let html = result.ctype.includes("text/html") ? result.buf.toString("utf8") : null;

      if (
        html &&
        looksLikeLoginPage(html) &&
        method === "GET" &&
        !req.session?.tjAutoLoginTried
      ) {
        if (req.session) req.session.tjAutoLoginTried = true;
        const auto = await tryEnvAutoLogin(
          radarBaseUrl() + journalPhpPath(),
          upstreamHeaders,
          phpSess
        );
        if (auto) {
          storePhpSess(req, res, auto.newSess);
          result = auto;
          html = auto.ctype.includes("text/html") ? auto.buf.toString("utf8") : null;
        }
      }

      res.status(result.upstream.status);
      res.setHeader("Content-Type", result.ctype);
      res.setHeader("Cache-Control", "private, no-store");
      applyJournalEmbedCsp(res);

      // JSON APIs éventuelles — ne pas réécrire
      if (html != null) return res.send(rewriteJournalHtml(html));
      return res.send(result.buf);
    } catch (e) {
      return res
        .status(502)
        .send("Proxy Trading Journal indisponible : " + String(e.message || e));
    }
  };
}

module.exports = function createJournalBridgeRouter() {
  const router = express.Router();
  const proxy = createPhpProxy();

  // Ne pas parser avant : on lit le body brut pour ne rien perdre (multipart / fields)
  router.use(["/journal-embed", "/appjournal"], (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (req._body === true || Buffer.isBuffer(req.body) || typeof req.body === "string") {
      return next();
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      req.body = Buffer.concat(chunks);
      next();
    });
    req.on("error", next);
  });

  router.get("/api/journal-bridge/ping", (req, res) => {
    res.json({
      ok: true,
      mounted: true,
      app: "trading_journal_pro",
      upstream: radarBaseUrl() + journalPhpPath(),
      sso: !!bridgeSecret(),
      autoLoginEnv: !!(process.env.FORGE_JOURNAL_PASSWORD || process.env.TJ_PASSWORD),
      tradeScreensInject: false,
      injectDisabled: true,
      injectHardOff: true,
      clickRestore: true,
      cspClickFix: true,
      hrefClickFix: true,
      clickEverywhere: true,
      cspStrip: true,
      tradeRowObserver: true,
      relativeAssets: true,
      deepLinkFallback: true,
      navFix: true,
      ssoDirect: true,
      scriptSrcAttr: "none-stripped",
      version: 16,
    });
  });

  router.get("/api/journal-bridge/status", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) return res.json({ ok: false, active: false, premium: false });
    return res.json({
      ok: true,
      active: true,
      premium: true,
      email: user.email,
      embed: EMBED_PATH,
    });
  });

  /**
   * Architecture B — temporary deep-link: open radar TJ in a new tab with SSO.
   * Used when iframe click path is still unreliable for a given session.
   */
  router.get("/api/journal-bridge/radar-url", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }
    const token = makeSsoToken(user.email);
    if (!token) {
      return res.status(503).json({ ok: false, error: "sso_secret_missing" });
    }
    const u = new URL(radarBaseUrl() + journalPhpPath());
    u.searchParams.set("forge_sso", token);
    return res.json({
      ok: true,
      url: u.toString(),
      embed: EMBED_PATH,
      note: "default open = radar SSO direct (native TJ); embed optional",
    });
  });

  router.post("/api/journal-bridge/activate", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }
    return res.json({ ok: true, email: user.email, embed: EMBED_PATH });
  });

  router.all("/journal-embed", proxy);
  router.all("/journal-embed/", proxy);
  router.all("/journal-embed/*", proxy);
  router.all("/appjournal", proxy);
  router.all("/appjournal/", proxy);
  router.all("/appjournal/*", proxy);
  // Safety net: openTrade location.href → /trading_journal.php 404 on app.*
  router.all("/trading_journal.php", (req, res) => {
    const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    applyJournalEmbedCsp(res);
    res.redirect(302, "/journal-embed/" + q);
  });

  return router;
};
