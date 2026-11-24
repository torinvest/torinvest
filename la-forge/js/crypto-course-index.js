/**
 * Index formation Crypto — déblocage lots de 3 (même logique que Formation).
 */
(function () {
  "use strict";

  var BATCH = 3;

  function isModuleDone(p) {
    if (!p || typeof p !== "object") return false;
    if (p.completed) return true;
    var totalSteps = Number(p.totalSteps) || 5;
    var stepsDone = Number(p.stepsDone) || 0;
    if (stepsDone < totalSteps) return false;
    // Crypto : quiz + exercices obligatoires (pas de validation « lecture seule »).
    var quizTotal = Number(p.quizTotal) || 0;
    var quizScore = Number(p.quizScore) || 0;
    if (quizTotal < 1 || quizScore < quizTotal * 0.7) return false;
    var practiceTotal = Number(p.practiceTotal) || 0;
    var practiceScore = Number(p.practiceScore) || 0;
    if (practiceTotal < 1 || practiceScore < practiceTotal * 0.7) return false;
    return true;
  }

  function computeMaxUnlockedIndex(ids, modFn) {
    if (!ids.length) return -1;
    var maxIdx = Math.min(BATCH - 1, ids.length - 1);
    var batchStart = 0;
    while (batchStart + BATCH <= ids.length) {
      var batch = ids.slice(batchStart, batchStart + BATCH);
      var allDone = batch.every(function (id) {
        return isModuleDone(modFn(id));
      });
      if (!allDone) break;
      batchStart += BATCH;
      maxIdx = Math.min(batchStart + BATCH - 1, ids.length - 1);
    }
    return maxIdx;
  }

  function lotHint(ids, modFn, maxIdx) {
    if (maxIdx >= ids.length - 1) return "Tous les modules crypto sont ouverts.";
    var batchStart = Math.floor(maxIdx / BATCH) * BATCH;
    var batch = ids.slice(batchStart, batchStart + BATCH);
    var missing = batch.filter(function (id) {
      return !isModuleDone(modFn(id));
    });
    if (!missing.length) return "Le lot suivant est en cours d'ouverture…";
    var labels = missing.map(function (id) {
      var m = typeof getCryptoModuleById === "function" ? getCryptoModuleById(id) : null;
      return m ? m.num : id;
    });
    return (
      "Validez les " +
      missing.length +
      " module(s) restant(s) de ce lot (" +
      labels.join(", ") +
      ") pour débloquer les 3 suivants."
    );
  }

  window.isCryptoModuleUnlocked = function isCryptoModuleUnlocked(moduleId, progressFn) {
    var ids =
      typeof getCryptoModuleIds === "function"
        ? getCryptoModuleIds()
        : (window.CRYPTO_MODULES || []).map(function (m) {
            return m.id;
          });
    var modFn =
      progressFn ||
      (typeof getModuleProgress === "function"
        ? getModuleProgress
        : function () {
            return {};
          });
    var maxIdx = computeMaxUnlockedIndex(ids, modFn);
    var idx = ids.indexOf(moduleId);
    return idx >= 0 && idx <= maxIdx;
  };

  window.renderCryptoCourseIndex = function renderCryptoCourseIndex(me) {
    var list = document.getElementById("module-list");
    if (!list || typeof CRYPTO_MODULES === "undefined") return;

    var ids = getCryptoModuleIds();
    var modFn =
      typeof getModuleProgress === "function"
        ? getModuleProgress
        : function () {
            return {};
          };
    var overall =
      typeof getOverallProgress === "function"
        ? getOverallProgress(ids)
        : { done: 0, total: ids.length, pct: 0 };
    var subscribed = me && me.subscribed;

    var maxIdx = computeMaxUnlockedIndex(ids, modFn);
    var unlockFn = subscribed
      ? function (moduleId) {
          return isCryptoModuleUnlocked(moduleId, modFn);
        }
      : function () {
          return true;
        };
    var hintText = subscribed ? lotHint(ids, modFn, maxIdx) : "";

    var bar = document.getElementById("overall-bar");
    if (bar) bar.style.width = (subscribed ? overall.pct : 0) + "%";
    var text = document.getElementById("overall-text");
    if (text) {
      text.textContent = subscribed
        ? overall.done +
          " / " +
          overall.total +
          " modules validés (" +
          overall.pct +
          "%) — lot ouvert jusqu’à l’index " +
          (maxIdx + 1)
        : "Aperçu curriculum — abonnement Premium requis pour progresser.";
    }
    var banner = document.getElementById("unlock-banner");
    if (banner && subscribed) {
      banner.hidden = false;
      banner.textContent = hintText;
    }

    var hours = document.getElementById("forge-hours");
    if (hours && typeof getCryptoStatsLine === "function") {
      hours.textContent = getCryptoStatsLine() + " · mode Crypto ÉLITE";
    }
    var slogan = document.getElementById("forge-slogan-line");
    if (slogan) slogan.textContent = "Bases · marchés · DeFi · analyse · macro · process";

    list.innerHTML = "";

    if (!subscribed) {
      var lock = document.createElement("li");
      lock.style.cssText = "display:block;border:none;background:transparent;padding:0";
      lock.innerHTML =
        '<div class="alert alert-warn">Formation Crypto réservée aux abonnés Premium. <a href="' +
        (typeof forgePricingUrl === "function" ? forgePricingUrl() : "/la-forge/pricing.html") +
        '">Voir l’offre 349 €/an</a></div>';
      list.appendChild(lock);
    }

    var lockedParam = false;
    try {
      lockedParam =
        typeof URLSearchParams !== "undefined" &&
        new URLSearchParams((location && location.search) || "").get("locked_module") === "1";
    } catch (e) {}
    if (subscribed && lockedParam) {
      var lock2 = document.createElement("li");
      lock2.style.cssText = "display:block;border:none;background:transparent;padding:0";
      lock2.innerHTML =
        '<div class="alert alert-warn">Ce module crypto n’est pas encore débloqué. ' + hintText + "</div>";
      list.appendChild(lock2);
    }

    CRYPTO_COURSE_PARTS.forEach(function (part) {
      var partMods = CRYPTO_MODULES.filter(function (m) {
        return m.part === part.id;
      });
      if (!partMods.length) return;

      var visibleMods = subscribed
        ? partMods.filter(function (m) {
            return unlockFn(m.id);
          })
        : partMods;
      if (!visibleMods.length) return;

      var header = document.createElement("li");
      header.className = "course-part-header";
      header.style.cssText =
        "display:block;border:none;background:transparent;padding:1.5rem 0 0.5rem";
      header.innerHTML =
        '<div class="course-part-block"><h2>' +
        part.title +
        "</h2>" +
        '<div class="part-meta">' +
        part.week +
        " · ~" +
        part.hours +
        " h — " +
        part.blurb +
        "</div></div>";
      list.appendChild(header);

      partMods.forEach(function (m) {
        if (subscribed && !unlockFn(m.id)) return;

        var p = modFn(m.id);
        var practice = p.practiceTotal
          ? " · Exo " + (p.practiceScore || 0) + "/" + p.practiceTotal
          : "";
        var hintFn =
          typeof getModuleCompletionHint === "function"
            ? getModuleCompletionHint
            : function () {
                return [];
              };
        var missing = hintFn(m.id);
        var done = isModuleDone(p);
        var hint =
          !done && missing.length
            ? '<div class="mod-hint">Pour valider : ' + missing.join(" · ") + "</div>"
            : "";
        var badge = done
          ? '<span class="badge badge-done">Validé</span>'
          : p.stepsDone > 0 || p.quizScore > 0
            ? '<span class="badge badge-progress">En cours</span>'
            : '<span class="badge badge-free">' + m.num + "</span>";
        var meta = p.quizTotal
          ? "Quiz " + p.quizScore + "/" + p.quizTotal + practice + " · " + m.desc
          : m.desc;
        var li = document.createElement("li");
        if (!subscribed) li.classList.add("locked");
        var action;
        if (!subscribed) {
          action =
            '<a class="btn btn-secondary" href="' +
            (typeof forgePricingUrl === "function" ? forgePricingUrl() : "/la-forge/pricing.html") +
            '">Premium</a>';
        } else {
          action =
            '<a class="btn btn-secondary" href="' +
            m.href +
            '">' +
            (done ? "Revoir" : "Commencer") +
            "</a>";
        }
        li.innerHTML =
          '<div class="mod-info"><strong><span class="mod-num">' +
          m.num +
          "</span>" +
          m.title +
          "</strong>" +
          '<div class="mod-meta">' +
          meta +
          "</div>" +
          hint +
          "</div>" +
          badge +
          action;
        list.appendChild(li);
      });
    });

    if (subscribed) {
      var hiddenCount = CRYPTO_MODULES.filter(function (m) {
        return !unlockFn(m.id);
      }).length;
      if (hiddenCount > 0) {
        var teaser = document.createElement("li");
        teaser.id = "forge-crypto-unlock-teaser";
        teaser.style.cssText =
          "display:block;border:none;background:transparent;padding:1rem 0 0";
        teaser.innerHTML =
          '<div class="alert" style="font-size:0.88rem;border-color:rgba(45,212,191,.35)">' +
          "<strong>" +
          hiddenCount +
          " module(s) crypto à venir</strong> — masqués jusqu’au déblocage du lot. " +
          "<span style='color:var(--muted)'>" +
          hintText +
          "</span></div>";
        list.appendChild(teaser);
      }
    }
  };
})();

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("module-list")) return;
  const me =
    typeof initForgeGate === "function"
      ? await initForgeGate({ requirePremium: true })
      : typeof getMe === "function"
        ? await getMe()
        : null;
  if (!me) return;
  if (typeof initForgeProgress === "function") {
    await initForgeProgress(me.email);
  }
  renderCryptoCourseIndex(me);
});
