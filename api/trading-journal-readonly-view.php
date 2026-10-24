<?php
/**
 * Trading Journal Pro — détail trade en lecture seule (v4).
 *
 * Inclus au début de /var/www/torinvest/trading_journal.php via
 * deploy/vps/patch-trading-journal-readonly-view.sh
 *
 * Contrat URL v4 (critique) :
 *   ?page=history&edit=ID&readonly=1  → détail lecture seule
 *   ?page=history&edit=ID             → formulaire édition
 *
 * Pourquoi pas read= / view= seuls :
 *   TJ charge la fiche via edit= (PHP + JS location.search).
 *   Sans edit= dans l’URL visible, la fiche ne s’affiche pas → « ça marche pas ».
 *   view= collisionne avec les menus (view=historique).
 *
 * Legacy : read=ID ou view=ID (numérique) → redirect 302 vers edit=ID&readonly=1
 */
declare(strict_types=1);

function torinvest_journal_readonly_boot(): void
{
    static $booted = false;
    if ($booted) {
        return;
    }
    $booted = true;

    $editId = torinvest_journal_readonly_parse_id($_GET['edit'] ?? null);
    $readId = torinvest_journal_readonly_parse_id($_GET['read'] ?? null);
    $viewId = torinvest_journal_readonly_parse_id($_GET['view'] ?? null);
    $wantRo = torinvest_journal_readonly_flag_on($_GET['readonly'] ?? $_GET['ro'] ?? null);

    // Legacy URL sans edit= → remap (+ redirect HTTP hors CLI) pour que TJ charge la fiche
    $legacyId = $editId === null ? ($readId ?? $viewId) : null;
    if ($legacyId !== null && empty($GLOBALS['torinvest_tj_readonly_redirected'])) {
        $GLOBALS['torinvest_tj_readonly_redirected'] = true;
        $q = $_GET;
        unset($q['read'], $q['view'], $q['ro']);
        $q['page'] = $q['page'] ?? 'history';
        $q['edit'] = (string) $legacyId;
        $q['readonly'] = '1';
        if (PHP_SAPI !== 'cli' && !headers_sent()) {
            $target = torinvest_journal_readonly_self_path() . '?' . http_build_query($q);
            header('Location: ' . $target, true, 302);
            exit;
        }
        // CLI / headers déjà envoyés : remap in-place
        $_GET['edit'] = (string) $legacyId;
        $_REQUEST['edit'] = (string) $legacyId;
        $_GET['readonly'] = '1';
        $_REQUEST['readonly'] = '1';
        unset($_GET['read'], $_REQUEST['read'], $_GET['view'], $_REQUEST['view']);
        $editId = $legacyId;
        $wantRo = true;
    }

    if ($editId !== null && $wantRo) {
        $GLOBALS['torinvest_tj_readonly'] = true;
        $GLOBALS['torinvest_tj_readonly_id'] = (string) $editId;
        // Ne pas laisser view= numérique polluer le routeur menus
        if ($viewId !== null) {
            unset($_GET['view'], $_REQUEST['view']);
        }
    } else {
        $GLOBALS['torinvest_tj_readonly'] = false;
    }

    if (PHP_SAPI === 'cli') {
        return;
    }

    if (!empty($GLOBALS['torinvest_tj_readonly_ob'])) {
        return;
    }
    $GLOBALS['torinvest_tj_readonly_ob'] = true;
    ob_start('torinvest_journal_readonly_ob_filter');
}

function torinvest_journal_readonly_self_path(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/trading_journal.php';
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '/trading_journal.php';
    }
    return $path;
}

/**
 * @param mixed $raw
 */
function torinvest_journal_readonly_flag_on($raw): bool
{
    if ($raw === null || $raw === '' || is_array($raw)) {
        return false;
    }
    $s = strtolower(trim((string) $raw));
    return in_array($s, ['1', 'true', 'yes', 'on', 'readonly'], true);
}

/**
 * @param mixed $raw
 */
function torinvest_journal_readonly_parse_id($raw): ?int
{
    if ($raw === null || $raw === '' || is_array($raw)) {
        return null;
    }
    $s = trim((string) $raw);
    if ($s === '' || !preg_match('/^\d{1,12}$/', $s)) {
        return null;
    }
    return (int) $s;
}

function torinvest_journal_readonly_ob_filter(string $html): string
{
    if ($html === '') {
        return $html;
    }
    $trim = ltrim($html);
    if ($trim !== '' && ($trim[0] === '{' || $trim[0] === '[')) {
        return $html;
    }
    if (stripos($html, '<html') === false && stripos($html, '</body>') === false) {
        return $html;
    }
    // Évite double inject (v4 prioritaire)
    if (strpos($html, 'torinvest-tj-readonly-v4') !== false) {
        return $html;
    }
    // Retire anciennes versions pour forcer v4
    $html = (string) preg_replace(
        '/<!-- torinvest-tj-readonly-ui -->.*?<script id="torinvest-tj-readonly-v[123]"[\s\S]*?<\/script>/i',
        '',
        $html,
        1
    );

    $readonly = !empty($GLOBALS['torinvest_tj_readonly']);
    $flag = $readonly ? '1' : '0';
    $id = (string) ($GLOBALS['torinvest_tj_readonly_id'] ?? '');
    if ($id === '' || !preg_match('/^\d{1,12}$/', $id)) {
        $parsed = torinvest_journal_readonly_parse_id($_GET['edit'] ?? $_GET['read'] ?? null);
        $id = $parsed !== null ? (string) $parsed : '';
    }
    $idJson = json_encode($id !== '' ? $id : null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($idJson === false) {
        $idJson = 'null';
    }

    $looksLikeTradeDetail =
        $readonly
        && (
            preg_match('/modifier\s+le\s+trade/iu', $html)
            || preg_match('/name=["\'](?:symbol|paire|entry|sl|tp|pnl|rr)/i', $html)
            || preg_match('/id=["\']edit[_-]?trade/i', $html)
        )
        && !preg_match('/name=["\']login_action["\']/i', $html)
        && stripos($html, 'Trading Journal Pro — Connexion') === false;

    if ($looksLikeTradeDetail) {
        $labelId = $id !== '' ? (' #' . $id) : '';
        $html = (string) preg_replace(
            '/(<title[^>]*>)(.*?)(<\/title>)/is',
            '$1Détail du trade' . $labelId . ' — lecture seule$3',
            $html,
            1
        );
        $html = (string) preg_replace(
            '/(<(?:h1|h2)[^>]*>)\s*Modifier\s+le\s+trade[^<]*(<\/(?:h1|h2)>)/iu',
            '$1Détail du trade' . $labelId . ' — lecture seule$2',
            $html,
            1
        );
        if (stripos($html, 'id="tj-readonly-banner"') === false) {
            $banner =
                '<div id="tj-readonly-banner">Mode lecture — tu consultes le détail du trade (sans modification).</div>';
            if (preg_match('/<body[^>]*>/i', $html)) {
                $html = (string) preg_replace('/(<body[^>]*>)/i', '$1' . $banner, $html, 1);
            }
        }
    }

    $script = <<<HTML
<!-- torinvest-tj-readonly-ui -->
<style id="torinvest-tj-readonly-css">
#tj-readonly-banner{
  margin:0 0 14px;padding:10px 12px;border-radius:8px;
  background:#f0f4f8;color:#1a2332;font-size:13px;font-weight:600;
  border:1px solid #d5dee8;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
}
#tj-readonly-actions{
  display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 8px;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
}
#tj-readonly-actions a{
  display:inline-flex;align-items:center;padding:10px 16px;border-radius:8px;
  font-weight:600;text-decoration:none;line-height:1.2;
}
#tj-readonly-actions a.tj-ro-edit{
  background:#1a5fb4;color:#fff;border:1px solid #1a5fb4;
}
#tj-readonly-actions a.tj-ro-edit:hover{background:#154a8c}
#tj-readonly-actions a.tj-ro-back{
  background:#fff;color:#1a2332;border:1px solid #c5ced8;
}
#tj-readonly-actions a.tj-ro-back:hover{background:#eef2f6}
body.tj-readonly input:not([type=hidden]):not([type=checkbox]):not([type=radio]),
body.tj-readonly select,
body.tj-readonly textarea{
  pointer-events:none!important;background:#f0f2f5!important;color:#222!important;
  opacity:1!important;
}
body.tj-readonly input[type=checkbox],
body.tj-readonly input[type=radio]{pointer-events:none!important}
body.tj-readonly button[type=submit],
body.tj-readonly input[type=submit]{display:none!important}
tr[onclick*="openTrade"], [data-trade-id], .trade-row, .cal-trade{ cursor:pointer; }
</style>
<script id="torinvest-tj-readonly-v4">(function(){
  if (window.__tjReadonlyViewV4) return; window.__tjReadonlyViewV4 = 1;
  var READONLY = {$flag};
  var TRADE_ID = {$idJson};

  function qs(u){
    try { return new URL(u, location.href); } catch(e){ return null; }
  }
  /** Lecture = edit= + readonly=1 (TJ charge toujours via edit=). */
  function toReadUrl(href){
    var u = qs(href); if (!u) return href;
    var id = u.searchParams.get("edit") || u.searchParams.get("read") || u.searchParams.get("view") || TRADE_ID;
    if (!id || !/^\\d{1,12}$/.test(String(id))) return href;
    u.searchParams.delete("read");
    if (u.searchParams.get("view") && /^\\d+$/.test(String(u.searchParams.get("view")))) {
      u.searchParams.delete("view");
    }
    u.searchParams.set("edit", String(id));
    u.searchParams.set("readonly", "1");
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }
  function toEditUrl(href){
    var u = qs(href || location.href); if (!u) return href || location.href;
    var id = u.searchParams.get("edit") || u.searchParams.get("read") || u.searchParams.get("view") || TRADE_ID;
    if (!id) return href || location.href;
    u.searchParams.delete("read");
    u.searchParams.delete("readonly");
    u.searchParams.delete("ro");
    if (u.searchParams.get("view") && /^\\d+$/.test(String(u.searchParams.get("view")))) {
      u.searchParams.delete("view");
    }
    u.searchParams.set("edit", String(id));
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }
  function backUrl(){
    var u = qs(location.href); if (!u) return location.pathname + "?page=history";
    u.searchParams.delete("edit");
    u.searchParams.delete("read");
    u.searchParams.delete("readonly");
    u.searchParams.delete("ro");
    if (u.searchParams.get("view") && /^\\d+$/.test(String(u.searchParams.get("view")))) {
      u.searchParams.delete("view");
    }
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }

  function rewriteListLinks(root){
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var links = scope.querySelectorAll("a[href*='edit=']");
    for (var i = 0; i < links.length; i++){
      var a = links[i];
      if (a.id === "tj-ro-edit-btn" || (a.classList && a.classList.contains("tj-ro-edit"))) continue;
      if (/modifier/i.test(a.textContent || "")) continue;
      var href = a.getAttribute("href") || "";
      if (!/[?&]edit=\\d+/i.test(href)) continue;
      if (/[?&]readonly=1\\b/i.test(href)) continue;
      a.setAttribute("href", toReadUrl(href));
    }
  }

  function goRead(id){
    var n = String(id == null ? "" : id).replace(/[^0-9]/g, "");
    if (!n) return;
    var dest = location.pathname + "?page=history&edit=" + encodeURIComponent(n) + "&readonly=1";
    try { location.assign(dest); } catch(e){ location.href = dest; }
  }

  function wrapOpenTrade(){
    function wrapped(id){
      var n = String(id == null ? "" : id).replace(/[^0-9]/g, "");
      if (!n) {
        var prev = window.openTrade && window.openTrade.__tjPrev;
        if (typeof prev === "function") return prev.apply(this, arguments);
        return;
      }
      goRead(n);
    }
    wrapped.__tjReadWrap = 1;
    if (typeof window.openTrade === "function" && !window.openTrade.__tjReadWrap) {
      wrapped.__tjPrev = window.openTrade;
    } else if (window.openTrade && window.openTrade.__tjPrev) {
      wrapped.__tjPrev = window.openTrade.__tjPrev;
    }
    try {
      Object.defineProperty(window, "openTrade", {
        configurable: true,
        enumerable: true,
        get: function(){ return wrapped; },
        set: function(fn){
          if (typeof fn === "function" && !fn.__tjReadWrap) wrapped.__tjPrev = fn;
        }
      });
    } catch(e){
      window.openTrade = wrapped;
    }
    window.viewTrade = goRead;
    window.readTrade = goRead;
  }

  function guardEditNavigation(){
    function rewriteIfEdit(url){
      try {
        var u = new URL(String(url || ""), location.href);
        var edit = u.searchParams.get("edit");
        if (!edit || !/^\\d+$/.test(String(edit))) return null;
        if (u.searchParams.get("readonly") === "1" || u.searchParams.get("ro") === "1") return null;
        // Bouton Modifier explicite → laisser edit= sans readonly
        if (document.activeElement && document.activeElement.id === "tj-ro-edit-btn") return null;
        var v = u.searchParams.get("view");
        if (v && !/^\\d+$/.test(String(v))) return null;
        u.searchParams.set("readonly", "1");
        if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
        return u.pathname + u.search + u.hash;
      } catch(e){ return null; }
    }
    try {
      var desc = Object.getOwnPropertyDescriptor(Location.prototype, "href") ||
        Object.getOwnPropertyDescriptor(window.location, "href");
      if (desc && desc.set) {
        Object.defineProperty(window.location, "href", {
          configurable: true,
          get: function(){ return desc.get ? desc.get.call(window.location) : String(window.location); },
          set: function(v){
            var next = rewriteIfEdit(v);
            desc.set.call(window.location, next || v);
          }
        });
      }
    } catch(e){}
    try {
      var _assign = location.assign.bind(location);
      location.assign = function(v){
        var next = rewriteIfEdit(v);
        return _assign(next || v);
      };
      var _replace = location.replace.bind(location);
      location.replace = function(v){
        var next = rewriteIfEdit(v);
        return _replace(next || v);
      };
    } catch(e2){}
  }

  function enableReadOnlyDetail(){
    document.body.classList.add("tj-readonly");
    var h = document.querySelector("h1,h2,.page-title,.content-header h1,.card-title");
    var form = document.querySelector("form");
    if (!form) form = document.querySelector("main, .content, .card, body");
    if (!form) return;

    var id = TRADE_ID;
    if (!id) {
      var m = location.search.match(/[?&](?:edit|read)=(\\d+)/i);
      id = m ? m[1] : "";
    }

    if (h) {
      var t = (h.textContent || "").trim();
      if (/modifier\\s+le\\s+trade/i.test(t) || /edit\\s+trade/i.test(t) || !/lecture/i.test(t)) {
        h.textContent = "Détail du trade" + (id ? " #" + id : "") + " — lecture seule";
      }
    }
    if (document.title && /modifier/i.test(document.title)) {
      document.title = "Détail du trade" + (id ? " #" + id : "");
    }

    var fields = form.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), select, textarea"
    );
    for (var i = 0; i < fields.length; i++){
      var el = fields[i];
      el.setAttribute("readonly", "readonly");
      el.setAttribute("disabled", "disabled");
      el.setAttribute("aria-readonly", "true");
      el.setAttribute("tabindex", "-1");
    }

    var forms = document.querySelectorAll("form");
    for (var f = 0; f < forms.length; f++){
      forms[f].addEventListener("submit", function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }, true);
    }

    var buttons = form.querySelectorAll("button, input[type=submit], input[type=button], a");
    for (var j = 0; j < buttons.length; j++){
      var b = buttons[j];
      if (b.id === "tj-ro-edit-btn" || (b.classList && b.classList.contains("tj-ro-edit"))) continue;
      if (b.classList && b.classList.contains("tj-ro-back")) continue;
      var label = ((b.textContent || b.value || "") + "").toLowerCase();
      if (/sauvegard|\\bsave\\b|enregistrer|submit|supprim|delete|mettre à jour|\\bupdate\\b/i.test(label)) {
        b.style.display = "none";
      }
    }

    if (!document.getElementById("tj-readonly-banner")) {
      var ban = document.createElement("div");
      ban.id = "tj-readonly-banner";
      ban.textContent = "Mode lecture — tu consultes le détail du trade (sans modification).";
      if (form.firstChild) form.insertBefore(ban, form.firstChild);
      else form.appendChild(ban);
    }

    if (!document.getElementById("tj-readonly-actions")) {
      var bar = document.createElement("div");
      bar.id = "tj-readonly-actions";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Actions détail trade");
      var edit = document.createElement("a");
      edit.id = "tj-ro-edit-btn";
      edit.className = "btn tj-ro-edit";
      edit.href = toEditUrl(location.href);
      edit.textContent = "Modifier";
      var back = document.createElement("a");
      back.className = "tj-ro-back";
      back.href = backUrl();
      back.textContent = "Retour";
      bar.appendChild(edit);
      bar.appendChild(back);
      form.appendChild(bar);
    }
  }

  function boot(){
    wrapOpenTrade();
    guardEditNavigation();
    rewriteListLinks(document);
    if (READONLY || /[?&]readonly=1\\b/i.test(location.search) || /[?&]ro=1\\b/i.test(location.search)) {
      enableReadOnlyDetail();
    }
    try {
      var mo = new MutationObserver(function(){
        wrapOpenTrade();
        rewriteListLinks(document);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch(e){}
    setInterval(function(){
      wrapOpenTrade();
      rewriteListLinks(document);
    }, 800);

    document.addEventListener("click", function(e){
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#tj-readonly-actions a.tj-ro-edit, #tj-ro-edit-btn")) return;
      var a = t.closest("a[href*='edit=']");
      if (a) {
        if (/modifier/i.test(a.textContent || "")) return;
        var href = a.getAttribute("href") || "";
        if (!/[?&]edit=\\d+/i.test(href)) return;
        if (/[?&]readonly=1\\b/i.test(href)) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        location.assign(toReadUrl(href));
        return;
      }
      var row = t.closest("[onclick*='openTrade'], [data-trade-id], .trade-row, .cal-trade");
      if (!row) return;
      if (t.closest("button, input, select, textarea, a[href]")) return;
      var id = row.getAttribute("data-trade-id") || row.getAttribute("data-id") || "";
      if (!id) {
        var oc = row.getAttribute("onclick") || "";
        var m = oc.match(/openTrade\\s*\\(\\s*['\"]?(\\d+)/i);
        if (m) id = m[1];
      }
      id = String(id).replace(/[^0-9]/g, "");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      goRead(id);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();</script>
HTML;

    if (stripos($html, '</body>') !== false) {
        return (string) preg_replace('/<\\/body>/i', $script . '</body>', $html, 1);
    }
    return $html . $script;
}
