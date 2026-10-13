/**
 * Index formation — déblocage lots de 3 (logique AUTO-CONTENUE).
 * Ne dépend plus de forge-unlock.js pour afficher F3+ (filet de sécu).
 */
(function () {
  "use strict";

  var BATCH = 3;

  function isModuleDone(p) {
    if (!p || typeof p !== "object") return false;
    if (p.completed) return true;
    var totalSteps = Number(p.totalSteps) || 12;
    var stepsDone = Number(p.stepsDone) || 0;
    if (stepsDone < totalSteps) return false;
    var quizTotal = Number(p.quizTotal) || 0;
    var quizScore = Number(p.quizScore) || 0;
    if (quizTotal > 0 && quizScore < quizTotal * 0.7) return false;
    var practiceTotal = Number(p.practiceTotal) || 0;
    var practiceScore = Number(p.practiceScore) || 0;
    if (practiceTotal > 0 && practiceScore < practiceTotal * 0.7) return false;
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

  function buildUnlockFn(ids, modFn) {
    var maxIdx = computeMaxUnlockedIndex(ids, modFn);
    // Si forge-unlock est présent et ouvre AU MOINS autant, on peut l'utiliser ;
    // sinon on force la logique locale (évite stub / script absent).
    if (typeof isModuleUnlocked === "function") {
      var extOpen = 0;
      for (var i = 0; i < ids.length; i++) {
        if (isModuleUnlocked(ids[i])) extOpen++;
        else break;
      }
      if (extOpen >= maxIdx + 1) {
        return function (moduleId) {
          return isModuleUnlocked(moduleId);
        };
      }
      console.warn(
        "[La Forge] forge-unlock sous-estime l'ouverture (ext=" +
          extOpen +
          ", local=" +
          (maxIdx + 1) +
          ") — logique index locale utilisée."
      );
    }
    return function (moduleId) {
      var idx = ids.indexOf(moduleId);
      return idx >= 0 && idx <= maxIdx;
    };
  }

  function lotHint(ids, modFn, maxIdx) {
    if (maxIdx >= ids.length - 1) return "Tous les modules sont ouverts.";
    var batchStart = Math.floor(maxIdx / BATCH) * BATCH;
    var batch = ids.slice(batchStart, batchStart + BATCH);
    var missing = batch.filter(function (id) {
      return !isModuleDone(modFn(id));
    });
    if (!missing.length) return "Le lot suivant est en cours d'ouverture…";
    var labels = missing.map(function (id) {
      var m = typeof getModuleById === "function" ? getModuleById(id) : null;
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

  window.renderCourseIndex = function renderCourseIndex(me) {
    var list = document.getElementById("module-list");
    if (!list || typeof MODULES === "undefined") return;

    var ids = getAllModuleIds();
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
      ? buildUnlockFn(ids, modFn)
      : function () {
          return true;
        };
    var openCount = subscribed ? maxIdx + 1 : 0;
    var hintText = subscribed ? lotHint(ids, modFn, maxIdx) : "";

    // Debug visible si ?unlock_debug=1
    var debug =
      typeof location !== "undefined" &&
      /(?:^|[?&])unlock_debug=1(?:&|$)/.test(location.search || "");

    if (subscribed) {
      console.log(
        "[La Forge unlock] open=" +
          openCount +
          "/" +
          ids.length +
          " maxIdx=" +
          maxIdx +
          " lot1done=" +
          ids.slice(0, 3).every(function (id) {
            return isModuleDone(modFn(id));
          }) +
          " sample=",
        ids.slice(0, 3).map(function (id) {
          var p = modFn(id) || {};
          return {
            id: id,
            completed: !!p.completed,
            steps: (p.stepsDone || 0) + "/" + (p.totalSteps || 12),
            done: isModuleDone(p),
          };
        })
      );
    }

    var titleEl = document.getElementById("forge-title");
    if (titleEl && typeof FORGE_TITLE !== "undefined") titleEl.textContent = FORGE_TITLE;

    var sloganEl = document.getElementById("forge-slogan-line");
    if (sloganEl && typeof FORGE_SLOGAN !== "undefined") sloganEl.textContent = FORGE_SLOGAN;

    var hoursEl = document.getElementById("forge-hours");
    if (hoursEl && typeof getForgePackageMetaLabel === "function") {
      hoursEl.textContent = getForgePackageMetaLabel() + " · 18 semaines · mode ÉLITE";
    } else if (hoursEl && typeof FORGE_TOTAL_HOURS !== "undefined") {
      hoursEl.textContent =
        "~" + FORGE_TOTAL_HOURS + " h · " + MODULES.length + " modules + Fondamental · mode ÉLITE";
    }

    var bar = document.getElementById("overall-bar");
    var txt = document.getElementById("overall-text");
    if (bar) bar.style.width = overall.pct + "%";
    if (txt)
      txt.textContent =
        overall.done + " / " + overall.total + " modules validés (" + overall.pct + "%)";

    var unlockBanner = document.getElementById("unlock-banner");
    if (unlockBanner && subscribed) {
      unlockBanner.hidden = false;
      unlockBanner.innerHTML =
        "<strong>Parcours guidé</strong> — " +
        openCount +
        " / " +
        ids.length +
        " modules ouverts · lot " +
        (maxIdx < 0 ? 0 : Math.floor(maxIdx / BATCH) + 1) +
        ".<br /><span style='color:var(--muted)'>" +
        hintText +
        "</span>" +
        (debug
          ? "<br /><code style='font-size:0.75rem'>maxIdx=" +
            maxIdx +
            " f03=" +
            unlockFn("f03") +
            "</code>"
          : "");
    } else if (unlockBanner) {
      unlockBanner.hidden = true;
    }

    list.innerHTML = "";

    if (!subscribed) {
      var lock = document.createElement("li");
      lock.style.cssText = "display:block;border:none;background:transparent;padding:0";
      lock.innerHTML =
        '<div class="alert alert-warn">Accès Premium requis pour ouvrir les modules. ' +
        '<a href="' +
        (typeof forgePricingUrl === "function" ? forgePricingUrl() : "/la-forge/pricing.html") +
        '">Voir l’offre 349 €/an</a></div>';
      list.appendChild(lock);
    }

    if (subscribed && new URLSearchParams(location.search).get("locked_module") === "1") {
      var lock2 = document.createElement("li");
      lock2.style.cssText = "display:block;border:none;background:transparent;padding:0";
      lock2.innerHTML =
        '<div class="alert alert-warn">Ce module n’est pas encore débloqué. ' + hintText + "</div>";
      list.appendChild(lock2);
    }

    COURSE_PARTS.forEach(function (part) {
      var partMods = MODULES.filter(function (m) {
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
      var hiddenCount = MODULES.filter(function (m) {
        return !unlockFn(m.id);
      }).length;
      if (hiddenCount > 0) {
        var teaser = document.getElementById("forge-unlock-teaser");
        if (!teaser) {
          teaser = document.createElement("li");
          teaser.id = "forge-unlock-teaser";
          teaser.style.cssText =
            "display:block;border:none;background:transparent;padding:1rem 0 0";
          list.appendChild(teaser);
        }
        teaser.innerHTML =
          '<div class="alert" style="font-size:0.88rem;border-color:rgba(255,180,0,.25)">' +
          "<strong>" +
          hiddenCount +
          " module(s) à venir</strong> — masqués jusqu’au déblocage du lot. " +
          "<span style='color:var(--muted)'>" +
          hintText +
          "</span></div>";
      }
    }
  };
})();

document.addEventListener("DOMContentLoaded", async () => {
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
  if (window.ForgeOnboarding && me.email) {
    ForgeOnboarding.markDone(me.email, "module0");
  }
  renderCourseIndex(me);
});
