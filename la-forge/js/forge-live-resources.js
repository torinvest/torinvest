/**
 * Ressources lives / modules — téléchargement PDF / screens Premium.
 * Admin : dépôt navigateur multi-fichiers (file cumulative) → VPS puis publication.
 */
(function () {
  "use strict";

  var state = {
    me: null,
    isAdmin: false,
    packs: [],
    pendingFiles: [], // File[] accumulés pour le formulaire de création
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

  function fileKey(file) {
    return [file.name, file.size, file.lastModified].join("::");
  }

  function addPendingFiles(fileList) {
    var incoming = Array.prototype.slice.call(fileList || []);
    var existing = {};
    state.pendingFiles.forEach(function (f) {
      existing[fileKey(f)] = true;
    });
    var skipped = 0;
    incoming.forEach(function (f) {
      if (!allowedBrowserFile(f)) {
        skipped += 1;
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        skipped += 1;
        return;
      }
      if (existing[fileKey(f)]) return;
      existing[fileKey(f)] = true;
      state.pendingFiles.push(f);
    });
    if (skipped) {
      alert(skipped + " fichier(s) ignoré(s) (type non supporté ou > 10 Mo).");
    }
    renderUploadQueue();
  }

  function removePendingAt(index) {
    state.pendingFiles.splice(index, 1);
    renderUploadQueue();
  }

  function clearPending() {
    state.pendingFiles = [];
    renderUploadQueue();
  }

  function renderUploadQueue() {
    var queue = document.getElementById("lr-upload-queue");
    if (!queue) return;
    if (!state.pendingFiles.length) {
      queue.hidden = true;
      queue.innerHTML = "";
      return;
    }
    queue.hidden = false;
    queue.innerHTML = state.pendingFiles
      .map(function (f, i) {
        var sizeKo = Math.max(1, Math.round(f.size / 1024));
        return (
          "<li><span>" +
          esc(f.name) +
          " <em style=\"color:var(--muted);font-size:0.8rem\">(" +
          sizeKo +
          " Ko)</em></span>" +
          '<button type="button" class="btn btn-secondary" data-lr-remove-pending="' +
          i +
          '">Retirer</button></li>'
        );
      })
      .join("");
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

  async function uploadMany(files, onProgress) {
    var uploaded = [];
    for (var i = 0; i < files.length; i++) {
      if (typeof onProgress === "function") onProgress(i + 1, files.length, files[i].name);
      uploaded.push(await uploadOneFile(files[i]));
    }
    return uploaded;
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
        meta.push((p.files || []).length + " fichier(s)");

        var adminBtns = "";
        if (state.isAdmin) {
          adminBtns =
            '<div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end">' +
            '<button type="button" class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.82rem" data-lr-add-files="' +
            esc(p.id) +
            '">+ Ajouter fichiers</button>' +
            '<button type="button" class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.82rem" data-lr-delete="' +
            esc(p.id) +
            '">Retirer</button>' +
            '<input type="file" multiple hidden data-lr-add-input="' +
            esc(p.id) +
            '" accept=".pdf,image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" />' +
            "</div>";
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

  async function appendFilesToPack(packId, fileList) {
    var pack = state.packs.find(function (p) {
      return p.id === packId;
    });
    if (!pack) throw new Error("Pack introuvable");
    var browserFiles = Array.prototype.slice.call(fileList || []).filter(allowedBrowserFile);
    if (!browserFiles.length) throw new Error("Aucun fichier valide");

    var uploaded = await uploadMany(browserFiles);
    var existing = (pack.files || []).map(function (f) {
      return { file: f.file, label: f.label || f.file };
    });
    var seen = {};
    existing.forEach(function (f) {
      seen[String(f.file || "").toLowerCase()] = true;
    });
    uploaded.forEach(function (f) {
      var key = String(f.file || "").toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      existing.push(f);
    });

    await api("/api/live-resources/" + encodeURIComponent(packId), {
      method: "PATCH",
      body: JSON.stringify({ files: existing }),
    });
    return uploaded.length;
  }

  function bindAdmin() {
    var form = document.getElementById("lr-admin-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";

    var uploadInput = document.getElementById("lr-upload");
    if (uploadInput) {
      uploadInput.addEventListener("change", function () {
        if (uploadInput.files && uploadInput.files.length) {
          addPendingFiles(uploadInput.files);
        }
        // reset pour pouvoir re-sélectionner les mêmes noms plus tard
        uploadInput.value = "";
      });
    }

    var queue = document.getElementById("lr-upload-queue");
    if (queue) {
      queue.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-lr-remove-pending]");
        if (!btn) return;
        removePendingAt(Number(btn.getAttribute("data-lr-remove-pending")));
      });
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

      var browserFiles = state.pendingFiles.slice();

      if (!browserFiles.length && !namesRaw.length) {
        alert("Ajoute au moins un PDF / screen (tu peux en sélectionner plusieurs, plusieurs fois).");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = browserFiles.length ? "Envoi des fichiers…" : "Publication…";
        }

        var uploaded = await uploadMany(browserFiles, function (n, total) {
          if (submitBtn) submitBtn.textContent = "Envoi " + n + "/" + total + "…";
        });

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
            "Pack enregistré, mais fichiers manquants sur le VPS :\n" + missing.join("\n")
          );
        } else {
          alert(
            files.length +
              " fichier(s) — pack publié. Les élèves peuvent télécharger."
          );
        }
        form.reset();
        clearPending();
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
        var addBtn = ev.target.closest("[data-lr-add-files]");
        if (addBtn) {
          var packId = addBtn.getAttribute("data-lr-add-files");
          var input = list.querySelector('[data-lr-add-input="' + packId + '"]');
          if (input) input.click();
          return;
        }

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

      list.addEventListener("change", async function (ev) {
        var input = ev.target.closest("[data-lr-add-input]");
        if (!input || !input.files || !input.files.length) return;
        var packId = input.getAttribute("data-lr-add-input");
        try {
          var n = await appendFilesToPack(packId, input.files);
          alert(n + " fichier(s) ajouté(s) au pack.");
          await reload();
        } catch (err) {
          alert(err.message || String(err));
        } finally {
          input.value = "";
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
