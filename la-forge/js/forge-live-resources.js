/**
 * Ressources lives / modules — téléchargement PDF / screens Premium.
 * Admin : dépôt navigateur → VPS puis publication du pack.
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

  function isImageFile(name) {
    return /\.(png|jpe?g|webp|gif)$/i.test(String(name || ""));
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

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Lecture fichier échouée"));
      };
      reader.readAsDataURL(file);
    });
  }

  function allowedBrowserFile(file) {
    if (!file) return false;
    var type = String(file.type || "").toLowerCase();
    if (type === "application/pdf" || type.indexOf("image/") === 0) return true;
    return /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.name || "");
  }

  async function uploadOneFile(file) {
    if (!allowedBrowserFile(file)) {
      throw new Error("Type non supporté : " + (file.name || "fichier"));
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Trop lourd (max 10 Mo) : " + file.name);
    }
    var dataUrl = await readFileAsDataUrl(file);
    var res = await api("/api/live-resources/upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        dataUrl: dataUrl,
      }),
    });
    return {
      file: res.file,
      label: res.label || String(res.file || "").replace(/\.(pdf|png|jpe?g|webp|gif)$/i, ""),
    };
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
            var openLabel = isImageFile(f.file) ? "Voir" : "Ouvrir";
            return (
              '<li class="lr-file">' +
              '<a class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.82rem" href="' +
              fileHref(p.id, f.file, true) +
              '">⬇ Télécharger — ' +
              esc(f.label || f.file) +
              "</a>" +
              ' <a class="lr-open" href="' +
              fileHref(p.id, f.file, false) +
              '" target="_blank" rel="noopener">' +
              openLabel +
              "</a>" +
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

  function updateUploadPreview() {
    var input = document.getElementById("lr-upload");
    var preview = document.getElementById("lr-upload-preview");
    if (!input || !preview) return;
    var files = input.files ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) {
      preview.hidden = true;
      preview.textContent = "";
      return;
    }
    preview.hidden = false;
    preview.textContent =
      files.length +
      " fichier(s) : " +
      files
        .map(function (f) {
          return f.name;
        })
        .join(", ");
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

    var uploadInput = document.getElementById("lr-upload");
    if (uploadInput) {
      uploadInput.addEventListener("change", updateUploadPreview);
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var submitBtn = form.querySelector('button[type="submit"]');
      var prevLabel = submitBtn ? submitBtn.textContent : "";

      var namesRaw = String(fd.get("files") || "")
        .split(/[\n,]+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);

      var browserFiles = uploadInput && uploadInput.files ? Array.prototype.slice.call(uploadInput.files) : [];

      if (!browserFiles.length && !namesRaw.length) {
        alert("Choisis au moins un PDF / screen à déposer, ou un nom déjà présent sur le VPS.");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = browserFiles.length
            ? "Envoi des fichiers…"
            : "Publication…";
        }

        var uploaded = [];
        for (var i = 0; i < browserFiles.length; i++) {
          if (submitBtn) {
            submitBtn.textContent =
              "Envoi " + (i + 1) + "/" + browserFiles.length + "…";
          }
          uploaded.push(await uploadOneFile(browserFiles[i]));
        }

        var fromNames = namesRaw.map(function (name) {
          var file = name.replace(/^.*[\\/]/, "");
          if (!/\.(pdf|png|jpe?g|webp|gif)$/i.test(file)) file += ".pdf";
          return {
            file: file,
            label: file.replace(/\.(pdf|png|jpe?g|webp|gif)$/i, ""),
          };
        });

        var files = uploaded.concat(fromNames);
        var seen = {};
        files = files.filter(function (f) {
          var key = String(f.file || "").toLowerCase();
          if (!key || seen[key]) return false;
          seen[key] = true;
          return true;
        });

        if (submitBtn) submitBtn.textContent = "Publication…";

        var payload = {
          title: String(fd.get("title") || "").trim(),
          liveDate: String(fd.get("liveDate") || "").trim() || null,
          kind: String(fd.get("kind") || "live"),
          description: String(fd.get("description") || "").trim(),
          notes: String(fd.get("notes") || "").trim(),
          moduleSlug: String(fd.get("moduleSlug") || "").trim() || null,
          files: files,
        };

        var res = await api("/api/live-resources", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        var missing = res.missingFiles || [];
        if (missing.length) {
          alert(
            "Pack enregistré, mais fichiers manquants sur le VPS :\n" +
              missing.join("\n")
          );
        } else {
          alert(
            uploaded.length
              ? "Fichiers déposés et pack publié — les élèves peuvent télécharger."
              : "Pack publié — les élèves peuvent télécharger."
          );
        }
        form.reset();
        updateUploadPreview();
        await reload();
      } catch (err) {
        alert(err.message || String(err));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prevLabel || "Publier pour les élèves";
        }
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
