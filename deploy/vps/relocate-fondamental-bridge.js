#!/usr/bin/env node
/**
 * @deprecated Utiliser ensure-fondamental-after-session.js
 */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
const script = path.join(__dirname, "ensure-fondamental-after-session.js");
const appDir = process.argv[2] || "/home/ubuntu/torinvest-formation";
execSync("node " + JSON.stringify(script) + " " + JSON.stringify(appDir), {
  stdio: "inherit",
});
