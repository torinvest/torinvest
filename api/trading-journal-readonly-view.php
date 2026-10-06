<?php
/**
 * Trading Journal Pro — vue lecture seule d’un trade.
 *
 * Inclus au début de trading_journal.php (après le SSO) via
 * deploy/vps/patch-trading-journal-readonly-view.sh
 *
 * - ?page=history&view=ID  → charge le même écran que edit=ID mais en lecture
 * - Clics Historique / Calendrier → view= (pas edit=)
 * - Bouton « Modifier » sur la fiche → edit=ID
 */
declare(strict_types=1);

function torinvest_journal_readonly_boot(): void
{
    if (!empty($_GET['view']) && (string) $_GET['view'] !== '') {
        if (empty($_GET['edit'])) {
            $_GET['edit'] = (string) $_GET['view'];
        }
        $GLOBALS['torinvest_tj_readonly'] = true;
    }

    if (PHP_SAPI === 'cli') {
        return;
    }

    // Évite double buffer si déjà actif
    if (!empty($GLOBALS['torinvest_tj_readonly_ob'])) {
        return;
    }
    $GLOBALS['torinvest_tj_readonly_ob'] = true;
    ob_start('torinvest_journal_readonly_ob_filter');
}

function torinvest_journal_readonly_ob_filter(string $html): string
{
    if ($html === '' || stripos($html, '<html') === false) {
        return $html;
    }

    $readonly = !empty($GLOBALS['torinvest_tj_readonly']);
    $flag = $readonly ? '1' : '0';
    $script = <<<HTML
<script id="torinvest-tj-readonly-v1">(function(){
  if (window.__tjReadonlyView) return; window.__tjReadonlyView = 1;
  var READONLY = {$flag};

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
    var u = qs(href || location.href); if (!u) return href;
    var view = u.searchParams.get("view") || u.searchParams.get("edit");
    if (!view) return href;
    u.searchParams.delete("view");
    u.searchParams.set("edit", view);
    if (!u.searchParams.get("page")) u.searchParams.set("page", "history");
    return u.pathname + u.search + u.hash;
  }

  /** Réécrit les liens / handlers vers view= au lieu de edit= */
  function rewriteListLinks(root){
    var scope = root || document;
    var links = scope.querySelectorAll("a[href*='edit=']");
    for (var i = 0; i < links.length; i++){
      var a = links[i];
      var href = a.getAttribute("href") || "";
      if (/[?&]edit=\\d+/i.test(href) && !/[?&]view=\\d+/i.test(href)) {
        a.setAttribute("href", toViewUrl(href));
      }
    }
  }

  function wrapOpenTrade(){
    if (typeof window.openTrade !== "function" || window.openTrade.__tjReadWrap) return;
    var orig = window.openTrade;
    window.openTrade = function(id){
      var n = String(id == null ? "" : id).replace(/[^0-9]/g, "");
      if (!n) return orig.apply(this, arguments);
      var dest = location.pathname + "?page=history&view=" + encodeURIComponent(n);
      location.assign(dest);
    };
    window.openTrade.__tjReadWrap = 1;
  }

  function fieldLabel(el){
    var id = el.getAttribute("id") || el.getAttribute("name") || "";
    var lab = id ? document.querySelector("label[for='"+id.replace(/'/g,"\\'")+"']") : null;
    if (lab && lab.textContent) return lab.textContent.trim();
    var prev = el.previousElementSibling;
    if (prev && /^LABEL$/i.test(prev.tagName)) return prev.textContent.trim();
    var p = el.closest("label");
    if (p) return (p.textContent || "").trim();
    return (el.getAttribute("placeholder") || el.getAttribute("name") || "Champ").trim();
  }

  function valueOf(el){
    if (!el) return "";
    if (el.tagName === "SELECT") {
      var opt = el.options[el.selectedIndex];
      return opt ? (opt.textContent || opt.value || "") : el.value;
    }
    return el.value || el.textContent || "";
  }

  /** Transforme le formulaire « modifier le trade » en fiche lecture seule */
  function enableReadOnlyDetail(){
    var h = document.querySelector("h1,h2,.page-title");
    var form = document.querySelector("form");
    if (!form) {
      // fallback: page entière
      form = document.querySelector("main, .content, .card, body");
    }
    if (!form) return;

    if (h && /modifier/i.test(h.textContent || "")) {
      h.textContent = (h.textContent || "").replace(/modifier\\s+le\\s+trade/i, "Détail du trade") + " — lecture seule";
    } else if (h && !/lecture/i.test(h.textContent || "")) {
      var m = location.search.match(/[?&](?:view|edit)=(\\d+)/i);
      h.textContent = "Détail du trade" + (m ? " #" + m[1] : "") + " — lecture seule";
    }

    var fields = form.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), select, textarea");
    for (var i = 0; i < fields.length; i++){
      var el = fields[i];
      el.setAttribute("readonly", "readonly");
      el.setAttribute("disabled", "disabled");
      el.style.pointerEvents = "none";
      el.style.opacity = "0.95";
    }

    // Cache boutons sauvegarde
    var buttons = form.querySelectorAll("button, input[type=submit], input[type=button]");
    for (var j = 0; j < buttons.length; j++){
      var b = buttons[j];
      var t = (b.textContent || b.value || "").toLowerCase();
      if (/sauvegard|save|enregistrer|submit|supprim|delete/i.test(t)) {
        b.style.display = "none";
      }
    }

    // Barre d’actions lecture
    if (!document.getElementById("tj-readonly-actions")) {
      var bar = document.createElement("div");
      bar.id = "tj-readonly-actions";
      bar.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 8px;";
      var edit = document.createElement("a");
      edit.className = "btn";
      edit.href = toEditUrl(location.href);
      edit.textContent = "Modifier";
      edit.style.cssText = "display:inline-flex;align-items:center;padding:10px 16px;border-radius:8px;background:#6366f1;color:#fff;font-weight:700;text-decoration:none;";
      var back = document.createElement("a");
      back.href = location.pathname + "?page=history";
      back.textContent = "Retour à l’historique";
      back.style.cssText = "display:inline-flex;align-items:center;padding:10px 16px;border-radius:8px;border:1px solid #e2e8f0;color:#1a202c;font-weight:600;text-decoration:none;background:#fff;";
      bar.appendChild(edit);
      bar.appendChild(back);
      form.appendChild(bar);
    }

    // Bannière
    if (!document.getElementById("tj-readonly-banner")) {
      var ban = document.createElement("div");
      ban.id = "tj-readonly-banner";
      ban.textContent = "Mode lecture — tu consultes le détail du trade (sans modification).";
      ban.style.cssText = "margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#eef2ff;color:#3730a3;font-size:13px;font-weight:600;";
      form.insertBefore(ban, form.firstChild);
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

    // Capture: si un clic part encore vers edit=, bascule vers view= (sauf bouton Modifier)
    document.addEventListener("click", function(e){
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#tj-readonly-actions a[href*='edit=']")) return;
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
