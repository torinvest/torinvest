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
    uploading: false,
  };

  /** Compresse un screen (JPEG) pour passer la limite nginx ~1 Mo. */
  function compressImageFile(file, maxSide, quality) {
    maxSide = maxSide || 1600;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Fichier image requis (JPEG/PNG/WebP)"));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) throw new Error("Image illisible");
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          var dataUrl = canvas.toDataURL("image/jpeg", quality);
          URL.revokeObjectURL(url);
          // Si encore trop gros pour nginx (~700 Ko JSON), recompresser.
          if (dataUrl.length > 700000 && quality > 0.55) {
            resolve(canvas.toDataURL("image/jpeg", 0.62));
            return;
          }
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Impossible de lire l’image (HEIC non supporté — exporte en PNG/JPEG)"));
      };
      img.src = url;
    });
  }

  function readFormPayload(form) {
    var fd = new FormData(form);
    return {
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
  }

  async function ensureAnalysisSaved() {
    var a = state.current || {};
    var form = document.getElementById("swa-form");
    if (!form) throw new Error("Formulaire introuvable");
    var payload = readFormPayload(form);
    if (!String(payload.title || "").trim()) {
      throw new Error("Indique un titre, puis réessaie d’ajouter le screen.");
    }
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
    return state.current;
  }

  function setUploadStatus(msg, isError) {
    var el = document.getElementById("swa-upload-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "swa-upload-status" + (isError ? " swa-upload-status--err" : "");
  }

  async function postImage(analysisId, dataUrl, caption) {
    var res = await fetch(
      "/api/swing-analyses/" + encodeURIComponent(analysisId) + "/images",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: dataUrl, caption: caption || "" }),
      }
    );
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error(
          "Image trop lourde (limite serveur). Le screen a été rejeté — redéploie le fix nginx ou utilise une capture plus légère."
        );
      }
      throw new Error(data.error || "Erreur upload screen (" + res.status + ")");
    }
    return data;
  }

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

  /** Exemple pédagogique XAUUSD — scénario conditionnel multi-TF (ne sauvegarde pas). */
  function goldExampleForm() {
    return {
      title: "XAUUSD — Scénarios swing multi-timeframe",
      pair: "XAUUSD",
      timeframe: "D1",
      bias: "neutral",
      horizon: "Swing",
      thesis:
        "Le Gold travaille actuellement une zone importante de son dealing range D1. La lecture n’est pas directionnelle à ce stade : le D1 sert à localiser les grands entrepôts de liquidité, le M15 à observer si ces zones sont acceptées ou rejetées et le M5 à rechercher éventuellement le timing d’exécution.\n\n" +
        "Le prix évolue autour de 4 286 et reste dans une zone où plusieurs scénarios restent ouverts. La logique est donc conditionnelle : je ne trade pas simplement parce que le prix est en discount. J’attends de voir comment le marché réagit lorsqu’il attaque une poche de liquidité.",
      context:
        "Construire le biais swing à partir de :\n" +
        "- guidance de la Fed ;\n" +
        "- évolution du pricing des taux ;\n" +
        "- taux réels US ;\n" +
        "- dollar ;\n" +
        "- inflation ;\n" +
        "- emploi et croissance ;\n" +
        "- géopolitique / énergie si pertinent.\n\n" +
        "Scénario favorable à Gold :\n" +
        "Fed moins hawkish que prévu, détente des taux réels, dollar moins fort, pricing monétaire moins restrictif.\n\n" +
        "Scénario défavorable à Gold :\n" +
        "Fed plus hawkish, remontée des taux réels, dollar ferme, maintien ou renforcement d’un pricing restrictif.\n\n" +
        "Toujours comparer la réalité aux anticipations déjà pricées par le marché.",
      structure:
        "DEALING RANGE D1 :\n" +
        "environ 3 943 → 4 680.\n\n" +
        "Le prix se trouve actuellement dans la moitié basse / zone de discount du dealing range global.\n\n" +
        "Zones de liquidité et zones importantes :\n" +
        "- BSL proche : 4 390 – 4 400\n" +
        "- BSL supérieure : environ 4 680\n" +
        "- Zone D1 importante : 4 100 – 4 150\n" +
        "- Zone D1 majeure basse : 3 943 – 4 000\n" +
        "- SSL locale M15 : environ 4 235 – 4 250\n\n" +
        "Lecture multi-timeframe :\n" +
        "D1 = où se trouve la liquidité.\n" +
        "M15 = sweep, acceptation, reclaim ou displacement.\n" +
        "M5 = timing d’exécution après confirmation.",
      entryZone:
        "Pas d’entrée fixe à ce stade.\n\n" +
        "Scénario long :\n" +
        "attendre une prise de sell-side liquidity en M15/M5 suivie d’un reclaim, d’un displacement haussier puis d’un pullback.\n\n" +
        "Scénario short :\n" +
        "attendre une perte confirmée des lows M15, absence de reclaim et acceptation sous la zone avec displacement baissier.\n\n" +
        "Règle :\n" +
        "PAS DE PULLBACK = PAS D’ENTRÉE.",
      invalidation:
        "Invalidation dynamique selon le scénario.\n\n" +
        "Long :\n" +
        "invalidation si le marché accepte durablement sous la zone sweepée et produit une structure / displacement baissier.\n\n" +
        "Short :\n" +
        "invalidation si le marché reprend rapidement la zone perdue et produit reclaim + displacement haussier.\n\n" +
        "Ne jamais définir l’invalidation simplement parce qu’un niveau a été touché.",
      targets: [
        "4 390 – 4 400\nPremière zone de buy-side liquidity.",
        "4 680\nZone de buy-side liquidity D1 supérieure.",
        "En scénario baissier :\n4 100 – 4 150 puis 3 943 – 4 000.",
      ],
      projections:
        "Grand dealing range D1 :\n" +
        "Low ≈ 3 942,79\n" +
        "High ≈ 4 680\n" +
        "Equilibrium ≈ 4 311\n\n" +
        "Le Premium / Discount doit toujours être calculé relativement au dealing range choisi.\n\n" +
        "Possibilité de dealing ranges internes en M15 et M5 :\n" +
        "ils ne remplacent pas le dealing range D1 mais permettent d’affiner la localisation du prix.",
      scenarioBase:
        "Range / consolidation entre les pools de liquidité.\n\n" +
        "Tant que le prix ne produit pas une acceptation claire ou un displacement confirmé, ne pas imposer de direction swing.\n\n" +
        "Observer en priorité :\n" +
        "- 4 235 – 4 250 dessous\n" +
        "- 4 390 – 4 400 dessus.",
      scenarioBull:
        "1. Prise de SSL sous les lows locaux.\n" +
        "2. Rejet des prix inférieurs.\n" +
        "3. Reclaim M15.\n" +
        "4. Displacement haussier.\n" +
        "5. Pullback M5.\n" +
        "6. Entrée seulement si le risque / invalidation est propre.\n" +
        "7. Première cible : 4 390 – 4 400.\n" +
        "8. Si acceptation au-dessus : extension potentielle vers 4 680.\n\n" +
        "Contexte macro compatible :\n" +
        "Fed moins hawkish, taux réels en baisse, USD qui se détend, guidance plus souple.",
      scenarioBear:
        "1. Perte de 4 250 / 4 235.\n" +
        "2. Pas de reclaim.\n" +
        "3. Acceptation sous les lows.\n" +
        "4. Displacement baissier.\n" +
        "5. Pullback éventuel pour exécution.\n" +
        "6. Première zone : 4 100 – 4 150.\n" +
        "7. Zone majeure suivante : 3 943 – 4 000.\n\n" +
        "Contexte macro compatible :\n" +
        "Fed plus hawkish, taux réels en hausse, dollar fort, guidance restrictive.",
      checklist: [
        "MACRO — Fed / guidance / pricing des taux / taux réels / dollar cohérents avec le scénario ?",
        "D1 / M15 — Pool identifié → sweep ou acceptation → reclaim éventuel → displacement confirmé ?",
        "M5 — Pullback présent ? Timing propre ? Invalidation claire ? Risque acceptable ? Si non : FLAT.",
      ],
      notes:
        "Le but de cette fiche n’est pas de prédire Gold mais de travailler une logique conditionnelle.\n\n" +
        "Macro = pourquoi.\n" +
        "D1 = où.\n" +
        "M15 = quoi.\n" +
        "M5 = quand.\n\n" +
        "Ne jamais acheter simplement parce que le prix est en discount.\n" +
        "Ne jamais vendre simplement parce que le prix est en premium.\n" +
        "Le marché doit montrer sa réaction.",
    };
  }

  function applyGoldExample() {
    var base = state.current || emptyForm();
    var gold = goldExampleForm();
    state.current = Object.assign({}, base, gold, {
      id: base.id || null,
      images: base.images || [],
      published: Boolean(base.published),
      publishedAt: base.publishedAt || null,
      updatedAt: base.updatedAt || null,
    });
    state.mode = "edit";
    renderEdit();
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
        ? '<div class="swa-actions">' +
          '<button type="button" class="btn btn-secondary" id="swa-load-gold-list" title="Ouvre l’éditeur prérempli — n’enregistre pas">Charger exemple GOLD</button>' +
          '<button type="button" class="btn btn-primary" id="swa-new">Nouvelle analyse</button>' +
          "</div>"
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
    var goldList = document.getElementById("swa-load-gold-list");
    if (goldList) {
      goldList.addEventListener("click", function () {
        state.current = emptyForm();
        applyGoldExample();
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
      "</div>" +
      '<p class="swa-reaction-reminder">Je ne trade pas le niveau. Je trade la réaction du marché au niveau.</p>' +
      "</section>" +
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
        var enabling = !a.published;
        if (enabling) {
          if (!confirm("Publier cette analyse pour les élèves Premium ?")) return;
        } else {
          if (!confirm("Dépublier cette analyse ? Elle ne sera plus visible pour les élèves.")) return;
        }
        var notify = false;
        if (enabling) {
          notify = confirm(
            "Notifier les élèves maintenant ?\n\n• Discord (salon configuré)\n• Email Brevo (liste Accompagnement)\n\nOK = publier + notifier\nAnnuler = publier sans notifier"
          );
        }
        try {
          var data = await api("/api/swing-analyses/" + encodeURIComponent(a.id) + "/publish", {
            method: "POST",
            body: JSON.stringify({ enable: enabling, notify: notify }),
          });
          if (enabling && notify) {
            var n = data && data.notify;
            if (n && n.ok) {
              var parts = [];
              if (n.discord && n.discord.ok) parts.push("Discord OK");
              else if (n.discord && n.discord.skipped) parts.push("Discord non configuré");
              else parts.push("Discord échec");
              if (n.brevo && n.brevo.ok) parts.push("Email Brevo OK");
              else if (n.brevo && n.brevo.skipped) parts.push("Brevo non configuré");
              else parts.push("Brevo échec: " + ((n.brevo && n.brevo.error) || (n.error || "?")));
              alert("Publié.\nNotifications : " + parts.join(" · "));
            } else if (n) {
              alert(
                "Publié, mais notification incomplète : " +
                  (n.error || (n.hint || "vérifie Discord webhook + Brevo"))
              );
            }
          }
        } catch (err) {
          alert(err && err.message ? err.message : String(err));
          return;
        }
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
      '<button type="button" class="btn btn-secondary" id="swa-load-gold" title="Remplit les champs — n’enregistre pas">Charger exemple GOLD</button>' +
      '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      (a.id
        ? '<button type="button" class="btn btn-secondary" id="swa-preview">Voir</button>' +
          '<button type="button" class="btn btn-secondary" id="swa-delete">Supprimer</button>'
        : "") +
      "</div></div>" +
      "<h2>" +
      (a.id ? "Éditer l'analyse" : "Nouvelle analyse swing") +
      "</h2>" +
      '<p class="swa-muted swa-example-hint">Exemple GOLD = scénario conditionnel multi-TF (pas un signal auto). Modifiable avant Enregistrer.</p>' +
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
      '<p class="swa-reaction-reminder">Je ne trade pas le niveau. Je trade la réaction du marché au niveau.</p>' +
      field("Checklist 1", "check0", (a.checklist && a.checklist[0]) || "") +
      field("Checklist 2", "check1", (a.checklist && a.checklist[1]) || "") +
      field("Checklist 3", "check2", (a.checklist && a.checklist[2]) || "") +
      field("Notes privées coach", "notes", a.notes || "", "textarea") +
      '<section class="swa-upload">' +
      "<h3>Screens / captures</h3>" +
      '<p class="swa-muted">JPEG, PNG ou WebP. L’image est compressée automatiquement. Un titre suffit — l’analyse est enregistrée au besoin avant l’upload.</p>' +
      '<label class="btn btn-secondary swa-file-btn">Ajouter un screen<input type="file" id="swa-file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp" hidden /></label>' +
      '<label class="swa-field"><span>Légende du prochain screen</span><input id="swa-caption" placeholder="Ex. H4 — liquidité SSL prise" /></label>' +
      '<p class="swa-upload-status" id="swa-upload-status" aria-live="polite"></p>' +
      '<div class="swa-edit-gallery">' +
      imgList +
      "</div></section>" +
      "</form>";

    document.getElementById("swa-back").onclick = function () {
      state.mode = "list";
      loadList();
    };
    var loadGold = document.getElementById("swa-load-gold");
    if (loadGold) {
      loadGold.onclick = function () {
        applyGoldExample();
      };
    }
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
      try {
        await ensureAnalysisSaved();
        state.mode = "edit";
        renderEdit();
        alert("Enregistré.");
      } catch (err) {
        alert(err && err.message ? err.message : String(err));
      }
    };

    var file = document.getElementById("swa-file");
    if (file) {
      file.onchange = async function () {
        var f = file.files && file.files[0];
        if (!f || state.uploading) return;
        state.uploading = true;
        setUploadStatus("Compression du screen…");
        try {
          var dataUrl = await compressImageFile(f);
          setUploadStatus("Enregistrement + envoi…");
          var saved = await ensureAnalysisSaved();
          var caption = (document.getElementById("swa-caption") || {}).value || "";
          var data = await postImage(saved.id, dataUrl, caption);
          state.current = data.analysis;
          state.mode = "edit";
          renderEdit();
          setUploadStatus("Screen ajouté.");
        } catch (err) {
          var msg = err && err.message ? err.message : String(err);
          setUploadStatus(msg, true);
          alert("Upload screen : " + msg);
        } finally {
          state.uploading = false;
          file.value = "";
        }
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
