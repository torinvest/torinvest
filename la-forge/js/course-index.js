function renderCourseIndex(me) {
  const container = document.querySelector(".container");
  const list = document.getElementById("module-list");
  if (!list || typeof MODULES === "undefined") return;

  const ids = getAllModuleIds();
  const modFn = typeof getModuleProgress === "function" ? getModuleProgress : () => ({});
  const overall = typeof getOverallProgress === "function" ? getOverallProgress(ids) : { done: 0, total: ids.length, pct: 0 };
  const subscribed = me && me.subscribed;
  const hasUnlock = typeof isModuleUnlocked === "function";
  const unlockFn = hasUnlock
    ? isModuleUnlocked
    : function (moduleId) {
        const idx = ids.indexOf(moduleId);
        return idx >= 0 && idx < 3;
      };
  if (subscribed && !hasUnlock) {
    console.warn("[La Forge] forge-unlock.js absent — lot 1 seul (3 modules). Déployez pull-forge-assets.");
  }

  const titleEl = document.getElementById("forge-title");
  if (titleEl && typeof FORGE_TITLE !== "undefined") titleEl.textContent = FORGE_TITLE;

  const sloganEl = document.getElementById("forge-slogan-line");
  if (sloganEl && typeof FORGE_SLOGAN !== "undefined") sloganEl.textContent = FORGE_SLOGAN;

  const hoursEl = document.getElementById("forge-hours");
  if (hoursEl && typeof getForgePackageMetaLabel === "function") {
    hoursEl.textContent = getForgePackageMetaLabel() + " · 18 semaines · mode ÉLITE";
  } else if (hoursEl && typeof FORGE_TOTAL_HOURS !== "undefined") {
    hoursEl.textContent =
      "~" + FORGE_TOTAL_HOURS + " h · " + MODULES.length + " modules + Fondamental · mode ÉLITE";
  }

  const bar = document.getElementById("overall-bar");
  const txt = document.getElementById("overall-text");
  if (bar) bar.style.width = overall.pct + "%";
  if (txt) txt.textContent = overall.done + " / " + overall.total + " modules validés (" + overall.pct + "%)";

  const unlockBanner = document.getElementById("unlock-banner");
  if (unlockBanner && subscribed) {
    unlockBanner.hidden = false;
    if (typeof getUnlockSummaryText === "function") {
      unlockBanner.innerHTML =
        "<strong>Parcours guidé</strong> — " +
        getUnlockSummaryText() +
        ".<br /><span style='color:var(--muted)'>" +
        (typeof getNextUnlockHint === "function" ? getNextUnlockHint() : "") +
        "</span>";
    } else {
      unlockBanner.innerHTML =
        "<strong>Parcours guidé</strong> — 3 modules ouverts (lot 1). " +
        "<span style='color:var(--muted)'>Validez le lot pour débloquer les 3 suivants.</span>";
    }
  } else if (unlockBanner) {
    unlockBanner.hidden = true;
  }

  list.innerHTML = "";

  if (!subscribed) {
    const lock = document.createElement("li");
    lock.style.cssText = "display:block;border:none;background:transparent;padding:0";
    lock.innerHTML =
      '<div class="alert alert-warn">Accès Premium requis pour ouvrir les modules. ' +
      '<a href="' +
      (typeof forgePricingUrl === "function" ? forgePricingUrl() : "/la-forge/pricing.html") +
      '">Voir l’offre 349 €/an</a></div>';
    list.appendChild(lock);
  }

  if (subscribed && new URLSearchParams(location.search).get("locked_module") === "1") {
    const lock = document.createElement("li");
    lock.style.cssText = "display:block;border:none;background:transparent;padding:0";
    lock.innerHTML =
      '<div class="alert alert-warn">Ce module n’est pas encore débloqué. ' +
      (typeof getNextUnlockHint === "function" ? getNextUnlockHint() : "Complétez le lot précédent.") +
      "</div>";
    list.appendChild(lock);
  }

  COURSE_PARTS.forEach((part) => {
    const partMods = MODULES.filter((m) => m.part === part.id);
    if (!partMods.length) return;

    const visibleMods = subscribed
      ? partMods.filter((m) => unlockFn(m.id))
      : partMods;
    if (!visibleMods.length) return;

    const header = document.createElement("li");
    header.className = "course-part-header";
    header.style.cssText = "display:block;border:none;background:transparent;padding:1.5rem 0 0.5rem";
    header.innerHTML =
      '<div class="course-part-block"><h2>' + part.title + "</h2>" +
      '<div class="part-meta">' + part.week + " · ~" + part.hours + " h — " + part.blurb + "</div></div>";
    list.appendChild(header);

    partMods.forEach((m) => {
      const pathUnlocked = subscribed && unlockFn(m.id);
      if (subscribed && !pathUnlocked) return;

      const p = modFn(m.id);
      const practice = p.practiceTotal ? " · Exo " + (p.practiceScore || 0) + "/" + p.practiceTotal : "";
      const hintFn = typeof getModuleCompletionHint === "function" ? getModuleCompletionHint : () => [];
      const missing = hintFn(m.id);
      const hint =
        !p.completed && missing.length
          ? '<div class="mod-hint">Pour valider : ' + missing.join(" · ") + "</div>"
          : "";
      const badge = p.completed
        ? '<span class="badge badge-done">Validé</span>'
        : p.stepsDone > 0 || p.quizScore > 0
          ? '<span class="badge badge-progress">En cours</span>'
          : '<span class="badge badge-free">' + m.num + "</span>";
      const meta = p.quizTotal
        ? "Quiz " + p.quizScore + "/" + p.quizTotal + practice + " · " + m.desc
        : m.desc;
      const li = document.createElement("li");
      if (!subscribed) li.classList.add("locked");
      let action;
      if (!subscribed) {
        action =
          '<a class="btn btn-secondary" href="' +
          (typeof forgePricingUrl === "function" ? forgePricingUrl() : "/la-forge/pricing.html") +
          '">Premium</a>';
      } else {
        action =
          '<a class="btn btn-secondary" href="' + m.href + '">' + (p.completed ? "Revoir" : "Commencer") + "</a>";
      }
      li.innerHTML =
        '<div class="mod-info"><strong><span class="mod-num">' + m.num + "</span>" + m.title + "</strong>" +
        '<div class="mod-meta">' + meta + "</div>" + hint + "</div>" +
        badge +
        action;
      list.appendChild(li);
    });
  });

  if (subscribed) {
    const hiddenCount = MODULES.filter((m) => !unlockFn(m.id)).length;
    if (hiddenCount > 0) {
      let teaser = document.getElementById("forge-unlock-teaser");
      if (!teaser) {
        teaser = document.createElement("li");
        teaser.id = "forge-unlock-teaser";
        teaser.style.cssText = "display:block;border:none;background:transparent;padding:1rem 0 0";
        list.appendChild(teaser);
      }
      const hint =
        typeof getNextUnlockHint === "function"
          ? getNextUnlockHint()
          : "Validez le lot actuel pour ouvrir les 3 modules suivants.";
      teaser.innerHTML =
        '<div class="alert" style="font-size:0.88rem;border-color:rgba(255,180,0,.25)">' +
        "<strong>" +
        hiddenCount +
        " module(s) à venir</strong> — masqués jusqu’au déblocage du lot. " +
        "<span style='color:var(--muted)'>" +
        hint +
        "</span></div>";
    }
  }
}

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
