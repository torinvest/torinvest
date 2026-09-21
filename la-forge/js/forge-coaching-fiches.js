/**
 * Fiches de suivi coaching — UI La Forge.
 * Admin : CRUD + notes privées + lien de partage.
 * Élève : lecture via token (?t=) ou fiches partagées assignées.
 */
(function () {
  "use strict";

  var LEVELS = [
    { id: "faible", label: "Faible" },
    { id: "progres", label: "En progrès" },
    { id: "bonne", label: "Bonne" },
    { id: "solide", label: "Solide" },
  ];

  var state = {
    me: null,
    isAdmin: false,
    fiches: [],
    current: null,
    mode: "list", // list | edit | view
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emptyFiche() {
    return {
      studentName: "",
      studentEmail: "",
      date: new Date().toISOString().slice(0, 10),
      moduleTheme: "",
      duration: "",
      positives: ["", "", ""],
      difficulties: ["", "", ""],
      priorityAxis: "",
      mustUnderstand: ["", "", ""],
      mustDo: ["", "", ""],
      exercise1: "",
      exercise2: "",
      routine: "",
      errorsToAvoid: ["", "", ""],
      nextLiveGoal: "",
      evolution: {
        comprehension: "",
        regularite: "",
        autonomie: "",
        application: "",
      },
      coachKeyPoint: "",
      axeDuMoment: "STRUCTURE — COMPRÉHENSION — APPLICATION — RÉGULARITÉ",
      coachPrivateNotes: "",
      shared: false,
    };
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

  function padList(arr, n) {
    var out = Array.isArray(arr) ? arr.slice() : [];
    while (out.length < n) out.push("");
    return out;
  }

  function listFields(name, values, n) {
    var need = Math.max(n || 3, Array.isArray(values) ? values.length : 0);
    var vals = padList(values, need);
    return vals
      .map(function (v, i) {
        return (
          '<input class="cf-input" type="text" data-list="' +
          esc(name) +
          '" data-idx="' +
          i +
          '" value="' +
          esc(v) +
          '" placeholder="• …" />'
        );
      })
      .join("");
  }

  function levelRadios(key, current) {
    return LEVELS.map(function (lv) {
      var checked = current === lv.id ? " checked" : "";
      return (
        '<label class="cf-level">' +
        '<input type="radio" name="evo-' +
        esc(key) +
        '" value="' +
        esc(lv.id) +
        '"' +
        checked +
        " /> " +
        esc(lv.label) +
        "</label>"
      );
    }).join(" ");
  }

  function levelDisplay(current) {
    var found = LEVELS.find(function (l) {
      return l.id === current;
    });
    return found ? found.label : "—";
  }

  function readForm(root) {
    var f = emptyFiche();
    f.studentName = root.querySelector('[name="studentName"]').value;
    f.studentEmail = root.querySelector('[name="studentEmail"]').value;
    f.date = root.querySelector('[name="date"]').value;
    f.moduleTheme = root.querySelector('[name="moduleTheme"]').value;
    f.duration = root.querySelector('[name="duration"]').value;
    f.priorityAxis = root.querySelector('[name="priorityAxis"]').value;
    f.exercise1 = root.querySelector('[name="exercise1"]').value;
    f.exercise2 = root.querySelector('[name="exercise2"]').value;
    f.routine = root.querySelector('[name="routine"]').value;
    f.nextLiveGoal = root.querySelector('[name="nextLiveGoal"]').value;
    f.coachKeyPoint = root.querySelector('[name="coachKeyPoint"]').value;
    f.axeDuMoment = root.querySelector('[name="axeDuMoment"]').value;
    var priv = root.querySelector('[name="coachPrivateNotes"]');
    if (priv) f.coachPrivateNotes = priv.value;

    ["positives", "difficulties", "mustUnderstand", "mustDo", "errorsToAvoid"].forEach(function (key) {
      f[key] = Array.prototype.map.call(root.querySelectorAll('[data-list="' + key + '"]'), function (el) {
        return el.value;
      });
    });

    ["comprehension", "regularite", "autonomie", "application"].forEach(function (key) {
      var checked = root.querySelector('input[name="evo-' + key + '"]:checked');
      f.evolution[key] = checked ? checked.value : "";
    });

    return f;
  }

  function renderEditor(fiche) {
    var f = Object.assign(emptyFiche(), fiche || {});
    f.evolution = Object.assign(emptyFiche().evolution, (fiche && fiche.evolution) || {});
    return (
      '<form id="cf-form" class="cf-form card">' +
      '<div class="cf-form-head">' +
      "<h2>" +
      (f.id ? "Modifier la fiche" : "Nouvelle fiche de suivi") +
      "</h2>" +
      '<button type="button" class="btn btn-secondary" data-cf-back>← Liste</button>' +
      "</div>" +
      '<div class="cf-grid">' +
      '<label>Élève <input class="cf-input" name="studentName" value="' +
      esc(f.studentName) +
      '" required /></label>' +
      '<label>Email élève <input class="cf-input" name="studentEmail" type="email" value="' +
      esc(f.studentEmail) +
      '" placeholder="eleve@…" /></label>' +
      '<label>Date <input class="cf-input" name="date" type="date" value="' +
      esc(f.date) +
      '" /></label>' +
      '<label>Durée <input class="cf-input" name="duration" value="' +
      esc(f.duration) +
      '" placeholder="ex. 45 min" /></label>' +
      "</div>" +
      '<label class="cf-block">Module / thème <input class="cf-input" name="moduleTheme" value="' +
      esc(f.moduleTheme) +
      '" /></label>' +
      '<fieldset class="cf-section"><legend>1. Points positifs</legend>' +
      listFields("positives", f.positives, 6) +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>2. Difficultés identifiées</legend>' +
      listFields("difficulties", f.difficulties, 6) +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>3. Priorité de travail</legend>' +
      '<label class="cf-block">Axe principal<textarea class="cf-textarea" name="priorityAxis" rows="3">' +
      esc(f.priorityAxis) +
      "</textarea></label>" +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>4. Ce que l’élève doit comprendre</legend>' +
      listFields("mustUnderstand", f.mustUnderstand, 6) +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>5. Ce que l’élève doit être capable de faire</legend>' +
      listFields("mustDo", f.mustDo, 6) +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>6. Exercice / travail avant le prochain coaching</legend>' +
      '<label class="cf-block">Exercice 1<textarea class="cf-textarea" name="exercise1" rows="2">' +
      esc(f.exercise1) +
      "</textarea></label>" +
      '<label class="cf-block">Exercice 2<textarea class="cf-textarea" name="exercise2" rows="2">' +
      esc(f.exercise2) +
      "</textarea></label>" +
      '<label class="cf-block">Routine à conserver<textarea class="cf-textarea" name="routine" rows="2">' +
      esc(f.routine) +
      "</textarea></label>" +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>7. Erreurs à éviter</legend>' +
      listFields("errorsToAvoid", f.errorsToAvoid, 6) +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>8. Objectif pour le prochain live</legend>' +
      '<textarea class="cf-textarea" name="nextLiveGoal" rows="2">' +
      esc(f.nextLiveGoal) +
      "</textarea>" +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>9. Évolution observée</legend>' +
      '<div class="cf-evo"><span>Compréhension</span> ' +
      levelRadios("comprehension", f.evolution.comprehension) +
      "</div>" +
      '<div class="cf-evo"><span>Régularité</span> ' +
      levelRadios("regularite", f.evolution.regularite) +
      "</div>" +
      '<div class="cf-evo"><span>Autonomie</span> ' +
      levelRadios("autonomie", f.evolution.autonomie) +
      "</div>" +
      '<div class="cf-evo"><span>Application pratique</span> ' +
      levelRadios("application", f.evolution.application) +
      "</div>" +
      "</fieldset>" +
      '<fieldset class="cf-section"><legend>10. Synthèse coach</legend>' +
      '<label class="cf-block">Point clé à retenir<textarea class="cf-textarea" name="coachKeyPoint" rows="2">' +
      esc(f.coachKeyPoint) +
      "</textarea></label>" +
      '<label class="cf-block">Axe du moment<input class="cf-input" name="axeDuMoment" value="' +
      esc(f.axeDuMoment) +
      '" /></label>' +
      "</fieldset>" +
      '<fieldset class="cf-section cf-private"><legend>🔒 Annotations coach (toi seul)</legend>' +
      '<p class="cf-hint">Jamais visibles sur le lien élève.</p>' +
      '<textarea class="cf-textarea" name="coachPrivateNotes" rows="4" placeholder="Notes internes, ressenti, points à revoir au prochain live…">' +
      esc(f.coachPrivateNotes) +
      "</textarea>" +
      "</fieldset>" +
      '<div class="cf-actions">' +
      '<button type="submit" class="btn">Enregistrer</button>' +
      (f.id
        ? '<button type="button" class="btn btn-secondary" data-cf-share>' +
          (f.shared ? "Copier le lien élève" : "Activer le partage + copier le lien") +
          "</button>" +
          (f.shared
            ? '<button type="button" class="btn btn-secondary" data-cf-unshare>Couper le partage</button>'
            : "") +
          '<button type="button" class="btn btn-secondary cf-danger" data-cf-delete>Supprimer</button>'
        : "") +
      '<span id="cf-save-msg" class="cf-msg" aria-live="polite"></span>' +
      "</div>" +
      "</form>"
    );
  }

  function bullets(items) {
    var list = (items || []).filter(Boolean);
    if (!list.length) return "<p class=\"cf-empty-line\">—</p>";
    return (
      "<ul>" +
      list
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderReadonly(fiche, opts) {
    opts = opts || {};
    var f = fiche || emptyFiche();
    var evo = f.evolution || {};
    var studentOnly = opts.studentOnly === true || opts.admin === false;
    return (
      '<article class="cf-sheet card" id="cf-sheet-print">' +
      '<header class="cf-sheet-head">' +
      "<h1>Fiche coaching TORINVEST — La Forge</h1>" +
      (opts.showMeta
        ? '<p class="cf-meta">' +
          (f.shared ? '<span class="cf-badge cf-badge--on">Partagée</span>' : '<span class="cf-badge">Privée</span>') +
          "</p>"
        : "") +
      "</header>" +
      '<dl class="cf-meta-grid">' +
      "<div><dt>Élève</dt><dd>" +
      esc(f.studentName || "—") +
      "</dd></div>" +
      "<div><dt>Date</dt><dd>" +
      esc(f.date || "—") +
      "</dd></div>" +
      "<div><dt>Module / thème</dt><dd>" +
      esc(f.moduleTheme || "—") +
      "</dd></div>" +
      "<div><dt>Durée</dt><dd>" +
      esc(f.duration || "—") +
      "</dd></div>" +
      "</dl>" +
      '<section class="cf-block-view"><h2>1. Points positifs</h2>' +
      bullets(f.positives) +
      "</section>" +
      '<section class="cf-block-view"><h2>2. Difficultés identifiées</h2>' +
      bullets(f.difficulties) +
      "</section>" +
      '<section class="cf-block-view"><h2>3. Priorité de travail</h2><p><strong>Axe principal :</strong> ' +
      esc(f.priorityAxis || "—") +
      "</p></section>" +
      '<section class="cf-block-view"><h2>4. Ce que l’élève doit comprendre</h2>' +
      bullets(f.mustUnderstand) +
      "</section>" +
      '<section class="cf-block-view"><h2>5. Ce que l’élève doit être capable de faire</h2>' +
      bullets(f.mustDo) +
      "</section>" +
      '<section class="cf-block-view"><h2>6. Exercice / travail avant le prochain coaching</h2>' +
      "<p><strong>Exercice 1 :</strong> " +
      esc(f.exercise1 || "—") +
      "</p>" +
      "<p><strong>Exercice 2 :</strong> " +
      esc(f.exercise2 || "—") +
      "</p>" +
      "<p><strong>Routine à conserver :</strong> " +
      esc(f.routine || "—") +
      "</p></section>" +
      '<section class="cf-block-view"><h2>7. Erreurs à éviter</h2>' +
      bullets(f.errorsToAvoid) +
      "</section>" +
      '<section class="cf-block-view"><h2>8. Objectif pour le prochain live</h2><p>' +
      esc(f.nextLiveGoal || "—") +
      "</p></section>" +
      '<section class="cf-block-view"><h2>9. Évolution observée</h2>' +
      "<ul>" +
      "<li>Compréhension : <strong>" +
      esc(levelDisplay(evo.comprehension)) +
      "</strong></li>" +
      "<li>Régularité : <strong>" +
      esc(levelDisplay(evo.regularite)) +
      "</strong></li>" +
      "<li>Autonomie : <strong>" +
      esc(levelDisplay(evo.autonomie)) +
      "</strong></li>" +
      "<li>Application pratique : <strong>" +
      esc(levelDisplay(evo.application)) +
      "</strong></li>" +
      "</ul></section>" +
      '<section class="cf-block-view cf-synthesis"><h2>10. Synthèse coach</h2>' +
      "<p><strong>Point clé à retenir :</strong> " +
      esc(f.coachKeyPoint || "—") +
      "</p>" +
      "<p class=\"cf-axe\"><strong>AXE DU MOMENT :</strong> " +
      esc(f.axeDuMoment || "") +
      "</p></section>" +
      (!studentOnly && opts.admin && f.coachPrivateNotes
        ? '<section class="cf-block-view cf-private"><h2>🔒 Annotations coach</h2><p>' +
          esc(f.coachPrivateNotes).replace(/\n/g, "<br>") +
          "</p></section>"
        : "") +
      "</article>"
    );
  }

  function synthFileName(fiche) {
    var name = String((fiche && fiche.studentName) || "eleve")
      .trim()
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
    var date = String((fiche && fiche.date) || "").slice(0, 10) || "fiche";
    return "fiche-coaching-" + name + "-" + date + ".html";
  }

  /** HTML autonome = synthèse élève (sans notes privées) */
  function buildStudentExportHtml(fiche) {
    var body = renderReadonly(fiche, { admin: false, showMeta: false, studentOnly: true });
    return (
      "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"/>" +
      "<title>Fiche coaching — " +
      esc(fiche.studentName || "") +
      "</title>" +
      "<style>" +
      "body{font-family:Georgia,'Times New Roman',serif;max-width:820px;margin:2rem auto;padding:0 1.25rem;color:#111;line-height:1.5;background:#fff}" +
      "h1{font-size:1.45rem;margin:0 0 1rem;color:#8a6a00}" +
      "h2{font-size:1.05rem;margin:1.25rem 0 0.4rem;color:#8a6a00;border-bottom:1px solid #e5e5e5;padding-bottom:0.25rem}" +
      "dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.5rem 1rem;margin:0 0 1rem}" +
      "dt{font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:#666}" +
      "dd{margin:0.1rem 0 0;font-size:1rem}" +
      "ul{margin:0.25rem 0 0;padding-left:1.2rem}" +
      "li{margin:0.2rem 0}" +
      ".cf-axe{margin-top:0.75rem;padding:0.65rem 0.8rem;border-left:3px solid #c9a227;background:#faf6e8}" +
      ".cf-sheet{border:none}" +
      "@media print{body{margin:0;padding:0.5rem}}" +
      "</style></head><body>" +
      body +
      "<p style=\"margin-top:2rem;font-size:0.85rem;color:#666\">Document élève — La Forge · TORINVEST</p>" +
      "</body></html>"
    );
  }

  function downloadStudentSynth(fiche) {
    if (!fiche) return;
    var html = buildStudentExportHtml(fiche);
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = synthFileName(fiche);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function openStudentSynthPreview(fiche) {
    var html = buildStudentExportHtml(fiche);
    var w = window.open("", "_blank");
    if (!w) {
      alert("Autorise les pop-ups pour prévisualiser la synthèse.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function renderList() {
    var rows = state.fiches
      .map(function (f) {
        return (
          "<tr>" +
          "<td>" +
          esc(f.studentName || "—") +
          "<br><span class=\"cf-muted\">" +
          esc(f.studentEmail || "") +
          "</span></td>" +
          "<td>" +
          esc(f.date || "—") +
          "</td>" +
          "<td>" +
          esc(f.moduleTheme || "—") +
          "</td>" +
          "<td>" +
          (f.shared
            ? '<span class="cf-badge cf-badge--on">Partagée</span>'
            : '<span class="cf-badge">Privée</span>') +
          "</td>" +
          '<td class="cf-row-actions">' +
          '<button type="button" class="btn btn-secondary" data-cf-view="' +
          esc(f.id) +
          '">Voir</button>' +
          '<button type="button" class="btn btn-secondary" data-cf-download="' +
          esc(f.id) +
          '">Télécharger</button>' +
          '<button type="button" class="btn btn-secondary" data-cf-edit="' +
          esc(f.id) +
          '">Éditer</button>' +
          (f.shared
            ? '<button type="button" class="btn btn-secondary" data-cf-copy="' +
              esc(f.id) +
              '">Lien</button>'
            : "") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="cf-list-wrap">' +
      '<div class="cf-toolbar">' +
      "<h2>Mes fiches de suivi</h2>" +
      '<button type="button" class="btn" data-cf-new>+ Nouvelle fiche</button>' +
      "</div>" +
      (state.fiches.length
        ? '<div class="card cf-table-card"><table class="cf-table"><thead><tr>' +
          "<th>Élève</th><th>Date</th><th>Thème</th><th>Statut</th><th>Actions</th>" +
          "</tr></thead><tbody>" +
          rows +
          "</tbody></table></div>"
        : '<p class="cf-empty card">Aucune fiche pour l’instant. Crée la première après un coaching.</p>') +
      "</div>"
    );
  }

  function renderStudentList() {
    if (!state.fiches.length) {
      return (
        '<p class="cf-empty card">Aucune fiche de suivi partagée pour toi pour le moment.</p>'
      );
    }
    return (
      '<div class="cf-list-wrap"><h2>Tes fiches de suivi</h2>' +
      state.fiches
        .map(function (f) {
          return (
            '<div class="card cf-student-card">' +
            "<h3>" +
            esc(f.moduleTheme || "Coaching") +
            "</h3>" +
            '<p class="cf-muted">' +
            esc(f.date || "") +
            "</p>" +
            '<button type="button" class="btn btn-secondary" data-cf-view="' +
            esc(f.id) +
            '">Voir</button>' +
            '<button type="button" class="btn btn-secondary" data-cf-download="' +
            esc(f.id) +
            '">Télécharger</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function setMsg(text, isErr) {
    var el = document.getElementById("cf-save-msg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("cf-msg--err", Boolean(isErr));
  }

  function absoluteShareUrl(fiche) {
    if (!fiche || !fiche.shareToken) return "";
    return (
      location.origin +
      "/coaching-fiche.html?t=" +
      encodeURIComponent(fiche.shareToken)
    );
  }

  async function copyShareLink(fiche) {
    if (!fiche.shared) {
      var data = await api("/api/coaching-fiches/" + encodeURIComponent(fiche.id) + "/share", {
        method: "POST",
        body: JSON.stringify({ enable: true }),
      });
      fiche = data.fiche;
      state.current = fiche;
      var idx = state.fiches.findIndex(function (x) {
        return x.id === fiche.id;
      });
      if (idx >= 0) state.fiches[idx] = fiche;
    }
    var url = absoluteShareUrl(fiche) || dataShareUrl(fiche);
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Lien élève copié ✓");
    } catch (_) {
      window.prompt("Copie ce lien élève :", url);
      setMsg("Lien prêt à coller");
    }
    return fiche;
  }

  function dataShareUrl(fiche) {
    if (fiche && fiche.shareUrlPath) return location.origin + fiche.shareUrlPath;
    return "";
  }

  async function loadList() {
    var data = await api("/api/coaching-fiches");
    state.isAdmin = Boolean(data.isAdmin);
    state.fiches = data.fiches || [];
  }

  function paint() {
    var root = document.getElementById("coaching-fiches-root");
    if (!root) return;

    if (state.mode === "edit" && state.isAdmin) {
      root.innerHTML = renderEditor(state.current || emptyFiche());
      bindEditor(root);
      return;
    }

    if (state.mode === "view" && state.current) {
      root.innerHTML =
        '<div class="cf-toolbar">' +
        '<button type="button" class="btn btn-secondary" data-cf-back>← Retour</button>' +
        '<div class="cf-toolbar-actions">' +
        '<button type="button" class="btn btn-secondary" data-cf-preview>Ouvrir synthèse</button>' +
        '<button type="button" class="btn" data-cf-download-current>Télécharger</button>' +
        '<button type="button" class="btn btn-secondary" data-cf-print>Imprimer / PDF</button>' +
        (state.isAdmin
          ? '<button type="button" class="btn btn-secondary" data-cf-edit-current>Éditer</button>'
          : "") +
        "</div></div>" +
        '<p class="cf-muted" style="margin:0 0 0.75rem">Aperçu <strong>élève</strong> (sans annotations coach privées).</p>' +
        renderReadonly(state.current, { admin: false, showMeta: false, studentOnly: true });
      var back = root.querySelector("[data-cf-back]");
      if (back)
        back.addEventListener("click", function () {
          state.mode = "list";
          state.current = null;
          paint();
        });
      var dl = root.querySelector("[data-cf-download-current]");
      if (dl)
        dl.addEventListener("click", function () {
          downloadStudentSynth(state.current);
        });
      var prev = root.querySelector("[data-cf-preview]");
      if (prev)
        prev.addEventListener("click", function () {
          openStudentSynthPreview(state.current);
        });
      var pr = root.querySelector("[data-cf-print]");
      if (pr)
        pr.addEventListener("click", function () {
          window.print();
        });
      var ed = root.querySelector("[data-cf-edit-current]");
      if (ed)
        ed.addEventListener("click", function () {
          state.mode = "edit";
          paint();
        });
      return;
    }

    root.innerHTML = state.isAdmin ? renderList() : renderStudentList();
    bindList(root);
  }

  function bindList(root) {
    root.querySelector("[data-cf-new]")?.addEventListener("click", function () {
      state.current = emptyFiche();
      state.mode = "edit";
      paint();
    });
    root.querySelectorAll("[data-cf-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-cf-edit");
        state.current = state.fiches.find(function (f) {
          return f.id === id;
        });
        state.mode = "edit";
        paint();
      });
    });
    root.querySelectorAll("[data-cf-view]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-cf-view");
        try {
          var local = state.fiches.find(function (f) {
            return f.id === id;
          });
          if (local) {
            state.current = local;
          } else {
            var data = await api("/api/coaching-fiches/" + encodeURIComponent(id));
            state.current = data.fiche;
          }
          state.mode = "view";
          paint();
        } catch (err) {
          alert(err.message || String(err));
        }
      });
    });
    root.querySelectorAll("[data-cf-download]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-cf-download");
        var fiche = state.fiches.find(function (f) {
          return f.id === id;
        });
        if (!fiche) {
          alert("Fiche introuvable");
          return;
        }
        downloadStudentSynth(fiche);
      });
    });
    root.querySelectorAll("[data-cf-copy]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-cf-copy");
        var fiche = state.fiches.find(function (f) {
          return f.id === id;
        });
        try {
          await copyShareLink(fiche);
          paint();
        } catch (err) {
          alert(err.message || String(err));
        }
      });
    });
  }

  function bindEditor(root) {
    var form = root.querySelector("#cf-form");
    root.querySelector("[data-cf-back]")?.addEventListener("click", function () {
      state.mode = "list";
      state.current = null;
      loadList().then(paint).catch(function (e) {
        alert(e.message || String(e));
      });
    });

    form?.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var body = readForm(form);
      try {
        var data;
        if (state.current && state.current.id) {
          data = await api("/api/coaching-fiches/" + encodeURIComponent(state.current.id), {
            method: "PUT",
            body: JSON.stringify(body),
          });
        } else {
          data = await api("/api/coaching-fiches", {
            method: "POST",
            body: JSON.stringify(body),
          });
        }
        state.current = data.fiche;
        setMsg("Enregistré ✓");
        await loadList();
      } catch (err) {
        setMsg(err.message || String(err), true);
      }
    });

    root.querySelector("[data-cf-share]")?.addEventListener("click", async function () {
      try {
        if (!state.current || !state.current.id) {
          setMsg("Enregistre d’abord la fiche", true);
          return;
        }
        // Save first
        var body = readForm(form);
        var saved = await api("/api/coaching-fiches/" + encodeURIComponent(state.current.id), {
          method: "PUT",
          body: JSON.stringify(body),
        });
        state.current = saved.fiche;
        await copyShareLink(state.current);
        await loadList();
        paint();
        setMsg("Lien élève copié ✓");
      } catch (err) {
        setMsg(err.message || String(err), true);
      }
    });

    root.querySelector("[data-cf-unshare]")?.addEventListener("click", async function () {
      try {
        var data = await api(
          "/api/coaching-fiches/" + encodeURIComponent(state.current.id) + "/share",
          { method: "POST", body: JSON.stringify({ enable: false }) }
        );
        state.current = data.fiche;
        await loadList();
        paint();
        setMsg("Partage coupé");
      } catch (err) {
        setMsg(err.message || String(err), true);
      }
    });

    root.querySelector("[data-cf-delete]")?.addEventListener("click", async function () {
      if (!confirm("Supprimer définitivement cette fiche ?")) return;
      try {
        await api("/api/coaching-fiches/" + encodeURIComponent(state.current.id), {
          method: "DELETE",
        });
        state.current = null;
        state.mode = "list";
        await loadList();
        paint();
      } catch (err) {
        setMsg(err.message || String(err), true);
      }
    });
  }

  /** Page partage publique (?t=TOKEN) */
  async function initSharePage() {
    var root = document.getElementById("coaching-fiche-share-root");
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var token = params.get("t") || params.get("token") || "";
    if (!token) {
      root.innerHTML = '<p class="cf-empty card">Lien invalide — demande une nouvelle fiche à ton coach.</p>';
      return;
    }
    root.innerHTML = '<p class="cf-muted">Chargement de la fiche…</p>';
    try {
      var data = await api("/api/coaching-fiches/share/" + encodeURIComponent(token));
      root.innerHTML = renderReadonly(data.fiche, { admin: false, showMeta: false });
    } catch (err) {
      root.innerHTML =
        '<p class="cf-empty card">Impossible d’ouvrir cette fiche : ' +
        esc(err.message || String(err)) +
        "</p>";
    }
  }

  async function initCoachingFiches(me) {
    state.me = me || null;
    state.isAdmin = Boolean(me && me.isAdmin);

    // Lien nav admin-only
    if (state.isAdmin) {
      document.querySelectorAll("[data-cf-admin-nav]").forEach(function (el) {
        el.hidden = false;
      });
      var nav = document.querySelector(".header-nav");
      if (nav && !nav.querySelector('[data-cf-nav="1"]')) {
        var a = document.createElement("a");
        a.href = "https://app.torinvest-trading.com/coaching-fiches.html";
        a.textContent = "Fiches coaching";
        a.setAttribute("data-cf-nav", "1");
        if (/coaching-fiches/.test(location.pathname)) a.className = "active";
        var logout = nav.querySelector("#logout-btn");
        if (logout) nav.insertBefore(a, logout);
        else nav.appendChild(a);
      }
    }

    var root = document.getElementById("coaching-fiches-root");
    if (!root) return;

    if (!me) {
      root.innerHTML = '<p class="cf-empty card">Connexion requise.</p>';
      return;
    }

    if (!state.isAdmin) {
      root.innerHTML =
        '<div class="cf-empty card">' +
        "<p><strong>Compte non admin.</strong> Les fiches d’édition sont réservées au coach.</p>" +
        "<p class=\"cf-muted\">Si tu es le coach : sur le VPS, ajoute ton email puis redémarre :</p>" +
        "<pre style=\"white-space:pre-wrap;font-size:0.82rem;color:var(--gold)\">" +
        "ADMIN_EMAIL=ton@email.com curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-COACHING-FICHES.sh | bash" +
        "</pre>" +
        "<p class=\"cf-muted\">Élève : ouvre le lien de partage reçu après le coaching.</p>" +
        "</div>";
      // Toujours tenter de charger les fiches partagées assignées
      try {
        await loadList();
        if (state.fiches.length) {
          state.mode = "list";
          paint();
        }
      } catch (_) {}
      return;
    }

    try {
      await loadList();
      state.mode = "list";
      paint();
    } catch (err) {
      root.innerHTML =
        '<p class="cf-empty card">Fiches indisponibles : ' + esc(err.message || String(err)) + "</p>";
    }
  }

  window.initCoachingFiches = initCoachingFiches;
  window.initCoachingFicheShare = initSharePage;
})();
