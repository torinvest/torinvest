/**
 * Persistance légère JSON — scores, SMT, alertes, config admin.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { mergeConfig, getDefaultConfig } = require("./config");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function createStore(dataDir) {
  const root = path.join(dataDir, "macro-edge");
  ensureDir(root);

  function configPath() {
    return path.join(root, "config.json");
  }

  function historyPath(name) {
    return path.join(root, name + ".jsonl");
  }

  function loadConfig() {
    const over = readJson(configPath(), null);
    return mergeConfig(over);
  }

  function saveConfig(partial) {
    const current = readJson(configPath(), {});
    const next = Object.assign({}, current, partial || {});
    writeJson(configPath(), next);
    return mergeConfig(next);
  }

  function appendHistory(name, row) {
    const file = historyPath(name);
    ensureDir(root);
    const line = JSON.stringify(
      Object.assign({ ts: new Date().toISOString() }, row)
    );
    fs.appendFileSync(file, line + "\n", "utf8");
  }

  function readHistory(name, limit) {
    const file = historyPath(name);
    try {
      const lines = fs.readFileSync(file, "utf8").trim().split(/\n+/);
      const n = Math.max(1, Number(limit) || 50);
      return lines
        .slice(-n)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  return {
    root,
    dataDir,
    loadConfig,
    saveConfig,
    appendHistory,
    readHistory,
    getDefaultConfig,
  };
}

module.exports = { createStore };
