<?php
/**
 * Trading Journal Pro — vue détail trade en lecture seule.
 *
 * Inclus au début de /var/www/torinvest/trading_journal.php via
 * deploy/vps/patch-trading-journal-readonly-view.sh
 *
 * Contrat URL :
 *   ?page=history&view=ID  → détail lecture seule (champs désactivés)
 *   ?page=history&edit=ID  → formulaire édition (inchangé)
 *
 * Stratégie : réutilise le chargeur edit= pour afficher les données du trade,
 * puis convertit le formulaire en lecture seule + boutons Modifier / Retour.
 * Sur toutes les pages : openTrade(id) et liens edit= (liste/calendrier) → view=.
 */
declare(strict_types=1);

function torinvest_journal_readonly_boot(): void
{
    static $booted = false;
    if ($booted) {
        return;
    }
    $booted = true;

    $viewRaw = $_GET['view'] ?? null;
    $editRaw = $_GET['edit'] ?? null;
    $viewId = torinvest_journal_readonly_parse_id($viewRaw);
    $editId = torinvest_journal_readonly_parse_id($editRaw);

    // Clic trade → view=ID uniquement. Si edit= déjà présent (bouton Modifier), édition.
    if ($viewId !== null && $editId === null) {
        $_GET['edit'] = (string) $viewId;
        $_REQUEST['edit'] = (string) $viewId;
        $GLOBALS['torinvest_tj_readonly'] = true;
        $GLOBALS['torinvest_tj_readonly_id'] = (string) $viewId;
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
    if (strpos($html, 'torinvest-tj-readonly-v1') !== false) {
        return $html;
    }

    $readonly = !empty($GLOBALS['torinvest_tj_readonly']);
    $flag = $readonly ? '1' : '0';
    $id = (string) ($GLOBALS['torinvest_tj_readonly_id'] ?? '');
    if ($id === '' || !preg_match('/^\d{1,12}$/', $id)) {
        $parsed = torinvest_journal_readonly_parse_id($_GET['view'] ?? null);
        $id = $parsed !== null ? (string) $parsed : '';
    }
    $idJson = json_encode($id !== '' ? $id : null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($idJson === false) {
        $idJson = 'null';
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
</style>
<script id="torinvest-tj-readonly-v1">(function(){
  if (window.__tjReadonlyView) return; window.__tjReadonlyView = 1;
  var READONLY = {$flag};
  var TRADE_ID = {$idJson};

  function qs(u){
    try { return new URL(u, location.href); } catch(e){ return null; }
  }
  function toViewUrl(href){
    var u = qs(href); if (!u) return href;
    var edit = u.searchParams.get("edit");
    if (!edit) return href;
    u.searchParams.delete("edit");
    u.searchParams.set("view", edit);
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }
  function toEditUrl(href){
    var u = qs(href || location.href); if (!u) return href || location.href;
    var view = u.searchParams.get("view") || u.searchParams.get("edit") || TRADE_ID;
    if (!view) return href || location.href;
    u.searchParams.delete("view");
    u.searchParams.set("edit", String(view));
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }
  function backUrl(){
    var u = qs(location.href); if (!u) return location.pathname + "?page=history";
    u.searchParams.delete("view");
    u.searchParams.delete("edit");
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
      if (/[?&]edit=\\d+/i.test(href) && !/[?&]view=\\d+/i.test(href)) {
        a.setAttribute("href", toViewUrl(href));
      }
    }
  }

  function wrapOpenTrade(){
    function goView(id){
      var n = String(id == null ? "" : id).replace(/[^0-9]/g, "");
      if (!n) return;
      var dest = location.pathname + "?page=history&view=" + encodeURIComponent(n);
      try { location.assign(dest); } catch(e){ location.href = dest; }
    }
    if (typeof window.openTrade === "function" && window.openTrade.__tjReadWrap) {
      return;
    }
    var orig = window.openTrade;
    window.openTrade = function(id){
      var n = String(id == null ? "" : id).replace(/[^0-9]/g, "");
      if (!n) {
        if (typeof orig === "function") return orig.apply(this, arguments);
        return;
      }
      goView(n);
    };
    window.openTrade.__tjReadWrap = 1;
    if (typeof orig === "function") window.openTrade.__tjPrev = orig;
    window.viewTrade = goView;
  }

  function enableReadOnlyDetail(){
    document.body.classList.add("tj-readonly");
    var h = document.querySelector("h1,h2,.page-title,.content-header h1,.card-title");
    var form = document.querySelector("form");
    if (!form) form = document.querySelector("main, .content, .card, body");
    if (!form) return;

    var id = TRADE_ID;
    if (!id) {
      var m = location.search.match(/[?&](?:view|edit)=(\\d+)/i);
      id = m ? m[1] : "";
    }

    if (h) {
      var t = (h.textContent || "").trim();
      if (/modifier\\s+le\\s+trade/i.test(t) || /edit\\s+trade/i.test(t)) {
        h.textContent = "Détail du trade" + (id ? " #" + id : "") + " — lecture seule";
      } else if (!/lecture/i.test(t)) {
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
    rewriteListLinks(document);
    if (READONLY || /[?&]view=\\d+/i.test(location.search)) {
      enableReadOnlyDetail();
    }
    try {
      var mo = new MutationObserver(function(){
        wrapOpenTrade();
        rewriteListLinks(document);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch(e){}

    document.addEventListener("click", function(e){
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#tj-readonly-actions a.tj-ro-edit, #tj-ro-edit-btn")) return;
      var a = t.closest("a[href*='edit=']");
      if (!a) return;
      if (/modifier/i.test(a.textContent || "")) return;
      var href = a.getAttribute("href") || "";
      if (!/[?&]edit=\\d+/i.test(href)) return;
      e.preventDefault();
      location.assign(toViewUrl(href));
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
