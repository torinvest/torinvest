#!/usr/bin/env node
/** Tests déblocage modules par lots de 3 */
"use strict";

var assert = require("assert");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var sandbox = {
  MODULES: [
    { id: "a", href: "/course/a.html", num: "1" },
    { id: "b", href: "/course/b.html", num: "2" },
    { id: "c", href: "/course/c.html", num: "3" },
    { id: "d", href: "/course/d.html", num: "4" },
    { id: "e", href: "/course/e.html", num: "5" },
    { id: "f", href: "/course/f.html", num: "6" },
  ],
  progress: {},
};
sandbox.getAllModuleIds = function () {
  return sandbox.MODULES.map(function (m) { return m.id; });
};
sandbox.getModuleById = function (id) {
  return sandbox.MODULES.find(function (m) { return m.id === id; });
};
sandbox.getModuleProgress = function (id) {
  return sandbox.progress[id] || {};
};

var code = require("fs").readFileSync(
  path.join(root, "la-forge/js/forge-unlock.js"),
  "utf8"
);
vm.runInNewContext(code, sandbox);

assert.strictEqual(sandbox.isModuleUnlocked("a"), true);
assert.strictEqual(sandbox.isModuleUnlocked("c"), true);
assert.strictEqual(sandbox.isModuleUnlocked("d"), false);

sandbox.progress.a = { completed: true };
sandbox.progress.b = { completed: true };
assert.strictEqual(sandbox.isModuleUnlocked("d"), false);

sandbox.progress.c = { completed: true };
assert.strictEqual(sandbox.isModuleUnlocked("d"), true);
assert.strictEqual(sandbox.isModuleUnlocked("f"), true);
assert.strictEqual(sandbox.isModuleUnlocked("e"), true);

console.log("ALL PASS — forge-unlock (6 modules, lots de 3)");
