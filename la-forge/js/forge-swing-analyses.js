/**
 * Analyses & scénarios swing — lecture élève + éditeur admin + export PDF (print).
 */
(function () {
  "use strict";

  var state = {
    isAdmin: false,
    list: [],
    current: null,
    mode: "list", // list | view | edit
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paras(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map(function (p) {
        return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }

  function biasLabel(b) {
    if (b === "bullish") return "Haussier";
    if (b === "bearish") return "Baissier";
    if (b === "range") return "Range";
    return "Neutre";
  }

  function mediaUrl(analysisId, file) {
    return (
      "/api/swing-analyses/" +
      encodeURIComponent(analysisId) +
      "/media/" +
      encodeURIComponent(file)
    );
  }

  function emptyForm() {
    return {
      id: null,
      title: "",
      pair: "XAUUSD",
      timeframe: "H4",
      bias: "neutral",
      horizon: "swing",
      thesis: "",
      context: "",
      structure: "",
      invalidation: "",
      entryZone: "",
      targets: ["", "", ""],
      projections: "",
      scenarioBase: "",
      scenarioBull: "",
      scenarioBear: "",
      checklist: ["", "", ""],
      notes: "",
      images: [],
      published: false,
    };
  }

  function renderList() {
    var root = document.getElementById("swing-analyses-root");
    if (!root) return;

    var cards = state.list.length
      ? state.list
          .map(function (a) {
            return (
              '<article class="swa-card" data-open="' +
              esc(a.id) +
              '">' +
              '<div class="swa-card-meta">' +
              "<span>" +
              esc(a.pair) +
              " · " +
              esc(a.timeframe) +
              "</span>" +
              '<span class="swa-bias swa-bias--' +
              esc(a.bias) +
              '">' +
              biasLabel(a.bias) +
              "</span>" +
              (state.isAdmin
                ? '<span class="swa-pub">' +
                  (a.published ? "Publié" : "Brouillon") +
                  "</span>"
                : "") +
              "</div>" +
              "<h3>" +
              esc(a.title) +
              "</h3>" +
              '<p class="swa-muted">' +
              esc((a.updatedAt || "").slice(0, 10)) +
              (a.imageCount ? " · " + a.imageCount + " screen(s)" : "") +
              "</p></article>"
            );
          })
          .join("")
      : '<p class="swa-empty">Aucune analyse pour le moment.</p>';

    root.innerHTML =
      '<div class="swa-toolbar">' +
      "<div><h2>Analyses &amp; scénarios swing</h2>" +
      '<p class="swa-lead">Projections, niveaux, scénarios et screens — pour le swing.</p></div>' +
      (state.isAdmin
        ? '<button type="button" class="btn btn-primary" id="swa-new">Nouvelle analyse</button>'
        : "") +
      "</div>" +
      '<div class="swa-grid">' +
      cards +
      "</div>";

    root.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function () {
        openOne(el.getAttribute("data-open"));
      });
    });
    var neu = document.getElementById("swa-new");
    if (neu) {
      neu.addEventListener("click", function () {
        state.current = emptyForm();
        state.mode = "edit";
        renderEdit();
      });
    }
  }

  function renderView() {
    var a = state.current;
    var root = document.getElementById("swing-analyses-root");
    if (!root || !a) return;

    var imgs = (a.images || [])
      .map(function (img) {
        return (
          '<figure class="swa-figure">' +
          '<img src="' +
          esc(mediaUrl(a.id, img.file)) +
          '" alt="' +
          esc(img.caption || a.title) +
          '" loading="lazy" />' +
          (img.caption ? "<figcaption>" + esc(img.caption) + "</figcaption>" : "") +
          "</figure>"
        );
      })
      .join("");

    var targets = (a.targets || [])
      .map(function (t, i) {
        return "<li><strong>TP" + (i + 1) + "</strong> — " + esc(t) + "</li>";
      })
      .join("");

    var checks = (a.checklist || [])
      .map(function (c) {
        return "<li>" + esc(c) + "</li>";
      })
      .join("");

    root.innerHTML =
      '<div class="swa-view" id="swa-print-root">' +
      '<div class="swa-toolbar no-print">' +
      '<button type="button" class="btn btn-secondary" id="swa-back">← Liste</button>' +
      '<div class="swa-actions">' +
      '<button type="button" class="btn btn-secondary" id="swa-pdf">Télécharger PDF</button>' +
      (state.isAdmin
        ? '<button type="button" class="btn btn-secondary" id="swa-edit">Éditer</button>' +
          '<button type="button" class="btn btn-primary" id="swa-toggle-pub">' +
          (a.published ? "Dépublier" : "Publier") +
          "</button>"
        : "") +
      "</div></div>" +
      '<header class="swa-hero">' +
      '<p class="swa-kicker">Analyse swing · ' +
      esc(a.pair) +
      " · " +
      esc(a.timeframe) +
      '</p>' +
      "<h1>" +
      esc(a.title) +
      "</h1>" +
      '<div class="swa-badges">' +
      '<span class="swa-bias swa-bias--' +
      esc(a.bias) +
      '">' +
      biasLabel(a.bias) +
      "</span>" +
      "<span>" +
      esc(a.horizon || "swing") +
      "</span>" +
      (a.publishedAt
        ? "<span>" + esc(String(a.publishedAt).slice(0, 10)) + "</span>"
        : "") +
      "</div></header>" +
      '<section class="swa-section"><h2>Thèse</h2>' +
      paras(a.thesis) +
      "</section>" +
      (a.context
        ? '<section class="swa-section"><h2>Contexte</h2>' + paras(a.context) + "</section>"
        : "") +
      (a.structure
        ? '<section class="swa-section"><h2>Structure</h2>' + paras(a.structure) + "</section>"
        : "") +
      '<section class="swa-levels">' +
      "<h2>Niveaux clés</h2>" +
      '<div class="swa-level-grid">' +
      '<article><h3>Zone d\'entrée</h3><p>' +
      esc(a.entryZone || "—") +
      "</p></article>" +
      "<article><h3>Invalidation</h3><p>" +
      esc(a.invalidation || "—") +
      "</p></article>" +
      "<article><h3>Objectifs</h3><ul>" +
      (targets || "<li>—</li>") +
      "</ul></article>" +
      "</div></section>" +
      (a.projections
        ? '<section class="swa-section"><h2>Projections</h2>' + paras(a.projections) + "</section>"
        : "") +
      '<section class="swa-scenarios">' +
      "<h2>Scénarios</h2>" +
      '<div class="swa-scenario-grid">' +
      '<article><h3>Base</h3>' +
      paras(a.scenarioBase || "—") +
      "</article>" +
      '<article class="swa-sc-bull"><h3>Haussier</h3>' +
      paras(a.scenarioBull || "—") +
      "</article>" +
      '<article class="swa-sc-bear"><h3>Baissier</h3>' +
      paras(a.scenarioBear || "—") +
      "</article>" +
      "</div></section>" +
      (imgs ? '<section class="swa-section"><h2>Screens</h2><div class="swa-gallery">' + imgs + "</div></section>" : "") +
      (checks
        ? '<section class="swa-section"><h2>Checklist</h2><ul class="swa-check">' +
          checks +
          "</ul></section>"
        : "") +
      '<p class="swa-disclaimer">Contenu pédagogique — pas un conseil en investissement. Respecte ton plan de risque.</p>' +
      "</div>";

    document.getElementById("swa-back").onclick = function () {
      state.mode = "list";
      state.current = null;
      renderList();
    };
    document.getElementById("swa-pdf").onclick = function () {
      exportPdf();
    };
    var ed = document.getElementById("swa-edit");
    if (ed)
      ed.onclick = function () {
        state.mode = "edit";
        renderEdit();
      };
    var pub = document.getElementById("swa-toggle-pub");
    if (pub)
      pub.onclick = async function () {
        await api("/api/swing-analyses/" + encodeURIComponent(a.id) + "/publish", {
          method: "POST",
          body: JSON.stringify({ enable: !a.published }),
        });
        await openOne(a.id);
      };
  }

  function field(label, name, value, type) {
    type = type || "text";
    if (type === "textarea") {
      return (
        '<label class="swa-field"><span>' +
        esc(label) +
        "</span><textarea name=\"" +
        esc(name) +
        '" rows="4">' +
        esc(value) +
        "</textarea></label>"
      );
    }
    if (type === "select-bias") {
      return (
        '<label class="swa-field"><span>' +
        esc(label) +
        '</span><select name="bias">' +
        ["bullish", "bearish", "neutral", "range"]
          .map(function (b) {
            return (
              '<option value="' +
              b +
              '"' +
              (value === b ? " selected" : "") +
              ">" +
              biasLabel(b) +
              "</option>"
            );
          })
          .join("") +
        "</select></label>"
      );
    }
    return (
      '<label class="swa-field"><span>' +
      esc(label) +
      '</span><input name="' +
      esc(name) +
      '" value="' +
      esc(value) +
      '" /></label>'
    );
  }

  function renderEdit() {
    var a = state.current || emptyForm();
    var root = document.getElementById("swing-analyses-root");
    if (!root) return;

    var imgList = (a.images || [])
      .map(function (img) {
        return (
          '<div class="swa-edit-img" data-img="' +
          esc(img.id) +
          '">' +
          (a.id
            ? '<img src="' + esc(mediaUrl(a.id, img.file)) + '" alt="" />'
            : "") +
          '<input data-cap="' +
          esc(img.id) +
          '" value="' +
          esc(img.caption || "") +
          '" placeholder="Légende" />' +
          '<button type="button" class="btn btn-secondary" data-del-img="' +
          esc(img.id) +
          '">Retirer</button></div>'
        );
      })
      .join("");

    root.innerHTML =
      '<form class="swa-edit" id="swa-form">' +
      '<div class="swa-toolbar">' +
      '<button type="button" class="btn btn-secondary" id="swa-back">← Retour</button>' +
      '<div class="swa-actions">' +
      '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      (a.id
        ? '<button type="button" class="btn btn-secondary" id="swa-preview">Voir</button>' +
          '<button type="button" class="btn btn-secondary" id="swa-delete">Supprimer</button>'
        : "") +
      "</div></div>" +
      "<h2>" +
      (a.id ? "Éditer l'analyse" : "Nouvelle analyse swing") +
      "</h2>" +
      '<div class="swa-form-grid">' +
      field("Titre", "title", a.title) +
      field("Paire", "pair", a.pair) +
      field("Timeframe", "timeframe", a.timeframe) +
      field("Biais", "bias", a.bias, "select-bias") +
      field("Horizon", "horizon", a.horizon || "swing") +
      "</div>" +
      field("Thèse (analyse principale)", "thesis", a.thesis, "textarea") +
      field("Contexte (macro / news / session)", "context", a.context, "textarea") +
      field("Structure (ICT / PA / niveaux)", "structure", a.structure, "textarea") +
      '<div class="swa-form-grid">' +
      field("Zone d'entrée", "entryZone", a.entryZone, "textarea") +
      field("Invalidation", "invalidation", a.invalidation, "textarea") +
      "</div>" +
      field("Objectif 1", "target0", (a.targets && a.targets[0]) || "") +
      field("Objectif 2", "target1", (a.targets && a.targets[1]) || "") +
      field("Objectif 3", "target2", (a.targets && a.targets[2]) || "") +
      field("Projections (mesures, Fib, path)", "projections", a.projections, "textarea") +
      field("Scénario de base", "scenarioBase", a.scenarioBase, "textarea") +
      field("Scénario haussier", "scenarioBull", a.scenarioBull, "textarea") +
      field("Scénario baissier", "scenarioBear", a.scenarioBear, "textarea") +
      field("Checklist 1", "check0", (a.checklist && a.checklist[0]) || "") +
      field("Checklist 2", "check1", (a.checklist && a.checklist[1]) || "") +
      field("Checklist 3", "check2", (a.checklist && a.checklist[2]) || "") +
      field("Notes privées coach", "notes", a.notes || "", "textarea") +
      '<section class="swa-upload">' +
      "<h3>Screens / captures</h3>" +
      '<p class="swa-muted">JPEG, PNG ou WebP — max 6 Mo. Enregistre d\'abord l\'analyse pour ajouter des images.</p>' +
      (a.id
        ? '<label class="btn btn-secondary swa-file-btn">Ajouter un screen<input type="file" id="swa-file" accept="image/*" hidden /></label>' +
          '<label class="swa-field"><span>Légende du prochain screen</span><input id="swa-caption" placeholder="Ex. H4 — liquidité SSL prise" /></label>'
        : '<p class="swa-muted">Sauvegarde pour débloquer l\'upload.</p>') +
      '<div class="swa-edit-gallery">' +
      imgList +
      "</div></section>" +
      "</form>";

    document.getElementById("swa-back").onclick = function () {
      state.mode = "list";
      loadList();
    };
    var prev = document.getElementById("swa-preview");
    if (prev)
      prev.onclick = function () {
        openOne(a.id);
      };
    var del = document.getElementById("swa-delete");
    if (del)
      del.onclick = async function () {
        if (!confirm("Supprimer cette analyse ?")) return;
        await api("/api/swing-analyses/" + encodeURIComponent(a.id), { method: "DELETE" });
        state.mode = "list";
        loadList();
      };

    document.getElementById("swa-form").onsubmit = async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = {
        title: fd.get("title"),
        pair: fd.get("pair"),
        timeframe: fd.get("timeframe"),
        bias: fd.get("bias"),
        horizon: fd.get("horizon"),
        thesis: fd.get("thesis"),
        context: fd.get("context"),
        structure: fd.get("structure"),
        entryZone: fd.get("entryZone"),
        invalidation: fd.get("invalidation"),
        targets: [fd.get("target0"), fd.get("target1"), fd.get("target2")].filter(Boolean),
        projections: fd.get("projections"),
        scenarioBase: fd.get("scenarioBase"),
        scenarioBull: fd.get("scenarioBull"),
        scenarioBear: fd.get("scenarioBear"),
        checklist: [fd.get("check0"), fd.get("check1"), fd.get("check2")].filter(Boolean),
        notes: fd.get("notes"),
      };
      var data;
      if (a.id) {
        data = await api("/api/swing-analyses/" + encodeURIComponent(a.id), {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        data = await api("/api/swing-analyses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      state.current = data.analysis;
      state.mode = "edit";
      renderEdit();
      alert("Enregistré.");
    };

    var file = document.getElementById("swa-file");
    if (file) {
      file.onchange = async function () {
        var f = file.files && file.files[0];
        if (!f || !a.id) return;
        var reader = new FileReader();
        reader.onload = async function () {
          var caption = (document.getElementById("swa-caption") || {}).value || "";
          var data = await api(
            "/api/swing-analyses/" + encodeURIComponent(a.id) + "/images",
            {
              method: "POST",
              body: JSON.stringify({ dataUrl: reader.result, caption: caption }),
            }
          );
          state.current = data.analysis;
          renderEdit();
        };
        reader.readAsDataURL(f);
      };
    }

    root.querySelectorAll("[data-del-img]").forEach(function (btn) {
      btn.onclick = async function () {
        var id = btn.getAttribute("data-del-img");
        var data = await api(
          "/api/swing-analyses/" +
            encodeURIComponent(a.id) +
            "/images/" +
            encodeURIComponent(id),
          { method: "DELETE" }
        );
        state.current = data.analysis;
        renderEdit();
      };
    });
  }

  function exportPdf() {
    var root = document.getElementById("swa-print-root");
    if (!root) {
      window.print();
      return;
    }
    document.body.classList.add("swa-printing");
    window.print();
    setTimeout(function () {
      document.body.classList.remove("swa-printing");
    }, 500);
  }

  async function openOne(id) {
    var data = await api("/api/swing-analyses/" + encodeURIComponent(id));
    state.current = data.analysis;
    state.isAdmin = Boolean(data.isAdmin) || state.isAdmin;
    state.mode = "view";
    renderView();
  }

  async function loadList() {
    var data = await api("/api/swing-analyses");
    state.isAdmin = Boolean(data.isAdmin);
    state.list = data.analyses || [];
    state.mode = "list";
    if (state.isAdmin) {
      document.querySelectorAll("[data-swa-admin-nav]").forEach(function (el) {
        el.hidden = false;
        el.style.display = "";
      });
    }
    renderList();
  }

  window.initSwingAnalyses = async function (me) {
    state.isAdmin = Boolean(me && me.isAdmin);
    var root = document.getElementById("swing-analyses-root");
    if (!root) return;
    try {
      await loadList();
    } catch (err) {
      root.innerHTML =
        '<p class="swa-empty">Erreur : ' +
        esc(err && err.message ? err.message : String(err)) +
        "</p>";
    }
  };
})();
