/**
 * Bloque /course/* si l'utilisateur connecté n'est pas subscribed (serveur).
 * Monter AVANT express.static('public') sur le VPS.
 */
module.exports = function requireSubscribedForCourse(req, res, next) {
  const path = req.path || "";
  if (!path.startsWith("/course/") && path !== "/course" && path !== "/course/index.html") {
    return next();
  }

  const user = req.session?.user || req.user;
  if (!user) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/course/index.html");
    return res.redirect("/login.html?next=" + nextUrl);
  }

  if (!user.subscribed) {
    return res.redirect("/dashboard.html?locked=1");
  }

  return next();
};
