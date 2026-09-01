/**
 * Bloque /course/* si l'utilisateur connecté n'est pas subscribed (serveur).
 * Débloque les modules par lots de 3 selon la progression enregistrée.
 * Monter AVANT express.static('public') sur le VPS.
 */
const fs = require("fs");
const path = require("path");
const rules = require("./forge-progress-rules");
const moduleOrder = require("./course-module-order.json");
const unlock = require("./forge-unlock-server");

const ALLOWED_IDS = moduleOrder.map((m) => m.id);

function safeEmailFile(email) {
  return String(email || "guest").replace(/[^a-z0-9@._-]/gi, "_");
}

function readProgressModules(email, dataDir) {
  const progressDir = path.join(dataDir, "progress");
  try {
    const raw = fs.readFileSync(
      path.join(progressDir, safeEmailFile(email) + ".json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    const modules = parsed.modules || parsed;
    return rules.sanitizeModulesPayload(modules, {}, ALLOWED_IDS);
  } catch {
    return {};
  }
}

module.exports = function requireSubscribedForCourse(req, res, next) {
  const coursePath = req.path || "";
  const isFondamental =
    coursePath === "/fondamental.html" || coursePath === "/fondamental";
  const isCourse =
    coursePath.startsWith("/course/") ||
    coursePath === "/course" ||
    coursePath === "/course/index.html";

  if (!isCourse && !isFondamental) {
    return next();
  }

  const user = req.session?.user || req.user;
  if (!user) {
    const nextUrl = encodeURIComponent(
      req.originalUrl || (isFondamental ? "/fondamental.html" : "/course/index.html")
    );
    return res.redirect("/login.html?next=" + nextUrl);
  }

  if (!user.subscribed) {
    return res.redirect("/dashboard.html?locked=1");
  }

  if (!isCourse) {
    return next();
  }

  if (
    /\/course\/[^/]+\.html$/i.test(coursePath) &&
    !/\/course\/index\.html$/i.test(coursePath)
  ) {
    const dataDir = path.join(__dirname, "..", "data");
    const progress = readProgressModules(user.email, dataDir);
    const moduleId = unlock.getModuleIdFromCoursePath(coursePath);
    if (!moduleId || !unlock.isModuleUnlocked(moduleId, progress)) {
      return res.redirect("/course/index.html?locked_module=1");
    }
  }

  return next();
};
