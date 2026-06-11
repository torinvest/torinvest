function renderCourseIndex() {
  const container = document.querySelector(".container");
  const list = document.getElementById("module-list");
  if (!list || typeof MODULES === "undefined") return;

  const ids = getAllModuleIds();
  const modFn = typeof getModuleProgress === "function" ? getModuleProgress : () => ({});
  const overall = typeof getOverallProgress === "function" ? getOverallProgress(ids) : { done: 0, total: ids.length, pct: 0 };

  const titleEl = document.getElementById("forge-title");
  if (titleEl && typeof FORGE_TITLE !== "undefined") titleEl.textContent = FORGE_TITLE;

  const sloganEl = document.getElementById("forge-slogan-line");
  if (sloganEl && typeof FORGE_SLOGAN !== "undefined") sloganEl.textContent = FORGE_SLOGAN;

  const hoursEl = document.getElementById("forge-hours");
  if (hoursEl && typeof FORGE_TOTAL_HOURS !== "undefined") {
    hoursEl.textContent = FORGE_TOTAL_HOURS + " h · " + MODULES.length + " modules · 18 semaines · mode ÉLITE";
  }

  const bar = document.getElementById("overall-bar");
  const txt = document.getElementById("overall-text");
  if (bar) bar.style.width = overall.pct + "%";
  if (txt) txt.textContent = overall.done + " / " + overall.total + " modules validés (" + overall.pct + "%)";

  list.innerHTML = "";

  COURSE_PARTS.forEach((part) => {
    const partMods = MODULES.filter((m) => m.part === part.id);
    if (!partMods.length) return;

    const header = document.createElement("li");
    header.className = "course-part-header";
    header.style.cssText = "display:block;border:none;background:transparent;padding:1.5rem 0 0.5rem";
    header.innerHTML =
      '<div class="course-part-block"><h2>' + part.title + "</h2>" +
      '<div class="part-meta">' + part.week + " · ~" + part.hours + " h — " + part.blurb + "</div></div>";
    list.appendChild(header);

    partMods.forEach((m) => {
      const p = modFn(m.id);
      const practice = p.practiceTotal ? " · Exo " + (p.practiceScore || 0) + "/" + p.practiceTotal : "";
      const badge = p.completed
        ? '<span class="badge badge-done">Validé</span>'
        : p.stepsDone > 0 || p.quizScore > 0
          ? '<span class="badge badge-progress">En cours</span>'
          : '<span class="badge badge-free">' + m.num + "</span>";
      const meta = p.quizTotal ? "Quiz " + p.quizScore + "/" + p.quizTotal + practice + " · " + m.desc : m.desc;
      const li = document.createElement("li");
      li.innerHTML =
        '<div class="mod-info"><strong><span class="mod-num">' + m.num + "</span>" + m.title + "</strong>" +
        '<div class="mod-meta">' + meta + "</div></div>" + badge +
        '<a class="btn btn-secondary" href="' + m.href + '">' + (p.completed ? "Revoir" : "Commencer") + "</a>";
      list.appendChild(li);
    });
  });
}

document.addEventListener("DOMContentLoaded", renderCourseIndex);
