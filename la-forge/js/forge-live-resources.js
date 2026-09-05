/**
 * Ressources lives / modules — téléchargement PDF Premium.
 * Après chaque live, l'admin publie un pack ; l'élève télécharge les slides.
 */
(function () {
  "use strict";

  var state = {
    me: null,
    isAdmin: false,
    packs: [],
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isPremium(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") return true;
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  async function api(url, options) {
    var opts = Object.assign({ credentials: "same-origin" }, options || {});
    if (opts.body && typeof opts.body === "string") {
      opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    }
    var res = await fetch(url, opts);
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || data.hint || "Erreur serveur (" + res.status + ")");
    return data;
  }

  function kindLabel(kind) {
    if (kind === "module") return "Module";
    if (kind === "onboarding") return "Intégration";
    return "Live";
  }

  function fileHref(packId, fileName, download) {
    var href =
      "/api/live-resources/" +
      encodeURIComponent(packId) +
      "/file/" +
      encodeURIComponent(fileName);
    if (download) href += "?download=1";
    return href;
  }

  function renderPacks() {
    var root = document.getElementById("live-resources-list");
    if (!root) return;

    if (!state.packs.length) {
      root.innerHTML =
        '<p class="lr-empty">Aucune ressource publiée pour le moment. Après chaque live, ton coach y dépose les slides PDF.</p>';
      return;
    }

    root.innerHTML = state.packs
      .map(function (p) {
        var files = (p.files || [])
          .map(function (f) {
            if (!f.ready) {
              return (
                '<li class="lr-file lr-file--missing">' +
                esc(f.label || f.file) +
                " <em>(fichier bientôt disponible)</em></li>"
              );
            }
            return (
              '<li class="lr-file">' +
              '<a class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.82rem" href="' +
              fileHref(p.id, f.file, true) +
              '">⬇ Télécharger — ' +
              esc(f.label || f.file) +
              "</a>" +
              ' <a class="lr-open" href="' +
              fileHref(p.id, f.file, false) +
              '" target="_blank" rel="noopener">Ouvrir</a>' +
              "</li>"
            );
          })
          .join("");

        var meta = [];
        if (p.liveDate) meta.push(esc(p.liveDate));
        meta.push(kindLabel(p.kind));
        if (p.moduleSlug) meta.push("module: " + esc(p.moduleSlug));
        if (p.published === false) meta.push("brouillon");

        var adminBtns = "";
        if (state.isAdmin) {
          adminBtns =
            '<button type="button" class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.82rem" data-lr-delete="' +
            esc(p.id) +
            '">Retirer</button>';
        }

        return (
          '<article class="lr-card">' +
          '<div class="lr-card-top">' +
          "<div><h3>" +
          esc(p.title) +
          "</h3>" +
          '<p class="lr-meta">' +
          meta.join(" · ") +
          "</p>" +
          (p.description ? '<p class="lr-desc">' + esc(p.description) + "</p>" : "") +
          "</div>" +
          adminBtns +
          "</div>" +
          (state.isAdmin && p.notes ? '<p class="lr-notes">' + esc(p.notes) + "</p>" : "") +
          '<ul class="lr-files">' +
          files +
          "</ul>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderAdmin() {
    var panel = document.getElementById("live-resources-admin");
    if (!panel) return;
    panel.hidden = !state.isAdmin;
  }

  async function reload() {
    var data = await api("/api/live-resources");
    state.packs = data.packs || [];
    state.isAdmin = !!data.isAdmin;
    renderPacks();
    renderAdmin();
    var countEl = document.getElementById("lr-count");
    if (countEl) countEl.textContent = String(state.packs.length);
  }

  function bindAdmin() {
    var form = document.getElementById("lr-admin-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var filesRaw = String(fd.get("files") || "")
        .split(/[\n,]+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);

      var payload = {
        title: String(fd.get("title") || "").trim(),
        liveDate: String(fd.get("liveDate") || "").trim() || null,
        kind: String(fd.get("kind") || "live"),
        description: String(fd.get("description") || "").trim(),
        notes: String(fd.get("notes") || "").trim(),
        moduleSlug: String(fd.get("moduleSlug") || "").trim() || null,
        files: filesRaw.map(function (name) {
          var file = name.replace(/^.*[\\/]/, "");
          if (!/\.pdf$/i.test(file)) file += ".pdf";
          return { file: file, label: file.replace(/\.pdf$/i, "") };
        }),
      };

      try {
        var res = await api("/api/live-resources", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        var missing = res.missingFiles || [];
        if (missing.length) {
          alert(
            "Pack enregistré, mais PDF manquants sur le VPS :\n" +
              missing.join("\n") +
              "\n\nDépose-les dans /var/lib/torinvest/live-resources/"
          );
        } else {
          alert("Pack publié — les élèves peuvent télécharger.");
        }
        form.reset();
        await reload();
      } catch (err) {
        alert(err.message || String(err));
      }
    });

    var list = document.getElementById("live-resources-list");
    if (list && list.dataset.bound !== "1") {
      list.dataset.bound = "1";
      list.addEventListener("click", async function (ev) {
        var btn = ev.target.closest("[data-lr-delete]");
        if (!btn) return;
        var id = btn.getAttribute("data-lr-delete");
        if (!window.confirm("Retirer ce pack de la liste élèves ?")) return;
        try {
          await api("/api/live-resources/" + encodeURIComponent(id), { method: "DELETE" });
          await reload();
        } catch (err) {
          alert(err.message || String(err));
        }
      });
    }
  }

  async function initForgeLiveResources(me) {
    state.me = me || null;
    var root = document.getElementById("live-resources-root");
    if (!root) return;

    if (!isPremium(me) && !(me && me.isAdmin)) {
      root.innerHTML =
        '<div class="alert alert-warn">Ressources lives réservées aux abonnés <strong>La Forge Premium</strong>.</div>';
      return;
    }

    bindAdmin();
    try {
      await reload();
    } catch (err) {
      var list = document.getElementById("live-resources-list");
      if (list) {
        list.innerHTML =
          '<p class="lr-empty">Ressources indisponibles : ' + esc(err.message || err) + "</p>";
      }
    }
  }

  /** Mini-bloc pour une date / session (calendrier jour). */
  async function renderLiveResourcesForDate(mountId, dateKey) {
    var mount = typeof mountId === "string" ? document.getElementById(mountId) : mountId;
    if (!mount || !dateKey) return;
    try {
      var data = await api("/api/live-resources?liveDate=" + encodeURIComponent(dateKey));
      var packs = data.packs || [];
      if (!packs.length) {
        mount.hidden = true;
        return;
      }
      mount.hidden = false;
      mount.innerHTML =
        '<h3 style="color:var(--gold);font-size:1rem;margin:0 0 0.65rem">Ressources du live</h3>' +
        packs
          .map(function (p) {
            return (
              '<div style="margin-bottom:0.75rem"><strong>' +
              esc(p.title) +
              '</strong><ul style="margin:0.4rem 0 0;padding-left:1.1rem;line-height:1.6">' +
              (p.files || [])
                .filter(function (f) {
                  return f.ready;
                })
                .map(function (f) {
                  return (
                    '<li><a href="' +
                    fileHref(p.id, f.file, true) +
                    '">⬇ ' +
                    esc(f.label || f.file) +
                    "</a></li>"
                  );
                })
                .join("") +
              "</ul></div>"
            );
          })
          .join("") +
        '<p style="margin:0.5rem 0 0;font-size:0.85rem"><a href="/resources.html" style="color:var(--gold)">Toutes les ressources →</a></p>';
    } catch (_) {
      mount.hidden = true;
    }
  }

  window.initForgeLiveResources = initForgeLiveResources;
  window.renderLiveResourcesForDate = renderLiveResourcesForDate;
})();
