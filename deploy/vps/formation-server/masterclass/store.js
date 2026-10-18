/**
 * Persistance Masterclass — config, grants, progress, chapitres JSON.
 * Racine : {dataDir}/masterclass/
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

function createMasterclassStore(dataDir) {
  const root = path.join(dataDir, "masterclass");
  ensureDir(root);
  ensureDir(path.join(root, "chapters"));
  ensureDir(path.join(root, "progress"));

  function configPath() {
    return path.join(root, "config.json");
  }
  function grantsPath() {
    return path.join(root, "grants.json");
  }
  function indexPath() {
    return path.join(root, "index.json");
  }
  function chapterPath(num) {
    const n = String(num).padStart(2, "0");
    return path.join(root, "chapters", n + ".json");
  }
  function progressPath(email) {
    const safe = String(email || "guest").replace(/[^a-z0-9@._-]/gi, "_");
    return path.join(root, "progress", safe + ".json");
  }

  function loadConfig() {
    return mergeConfig(readJson(configPath(), null));
  }

  function saveConfig(partial) {
    const current = readJson(configPath(), {});
    const next = Object.assign({}, current, partial || {}, {
      updatedAt: new Date().toISOString(),
    });
    writeJson(configPath(), next);
    return mergeConfig(next);
  }

  function loadGrants() {
    const raw = readJson(grantsPath(), { grants: [] });
    return Array.isArray(raw.grants) ? raw.grants : [];
  }

  function saveGrants(grants) {
    writeJson(grantsPath(), {
      grants: grants || [],
      updatedAt: new Date().toISOString(),
    });
  }

  function hasGrant(email) {
    const want = String(email || "")
      .trim()
      .toLowerCase();
    if (!want) return false;
    return loadGrants().some((g) => {
      if (!g || !g.email) return false;
      if (String(g.email).trim().toLowerCase() !== want) return false;
      if (g.revokedAt) return false;
      if (g.expiresAt && new Date(g.expiresAt).getTime() < Date.now()) return false;
      return true;
    });
  }

  function loadIndex() {
    const idx = readJson(indexPath(), null);
    if (idx && Array.isArray(idx.chapters)) return idx;
    // Rebuild from chapter files
    const chapters = [];
    for (let i = 1; i <= 40; i++) {
      const ch = readJson(chapterPath(i), null);
      if (!ch) continue;
      chapters.push({
        id: ch.id || "ch" + String(i).padStart(2, "0"),
        number: ch.number || i,
        title: ch.title || "Chapitre " + i,
        slug: ch.slug || "chapitre-" + i,
        status: ch.status || "draft",
        sectionsCount: (ch.sections && ch.sections.length) || 0,
        tablesCount: (ch.tables && ch.tables.length) || 0,
        wordCount: ch.wordCount || 0,
      });
    }
    return {
      module: "masterclass-macro",
      title: "Masterclass Macroéconomie & Marchés Financiers",
      chapterCount: chapters.length,
      chapters,
    };
  }

  function saveIndex(index) {
    writeJson(indexPath(), index);
  }

  function loadChapter(num) {
    return readJson(chapterPath(num), null);
  }

  function listChapterNumbers() {
    const dir = path.join(root, "chapters");
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => /^\d{2}\.json$/.test(f))
        .map((f) => Number(f.slice(0, 2)))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  function loadProgress(email) {
    return readJson(progressPath(email), {
      email,
      chapters: {},
      updatedAt: null,
    });
  }

  function saveProgress(email, data) {
    const next = Object.assign({}, data, {
      email,
      updatedAt: new Date().toISOString(),
    });
    writeJson(progressPath(email), next);
    return next;
  }

  return {
    root,
    dataDir,
    loadConfig,
    saveConfig,
    loadGrants,
    saveGrants,
    hasGrant,
    loadIndex,
    saveIndex,
    loadChapter,
    listChapterNumbers,
    loadProgress,
    saveProgress,
    getDefaultConfig,
    chapterPath,
    indexPath,
  };
}

module.exports = { createMasterclassStore };
