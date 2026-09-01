/**
 * Stockage utilisateurs formation (data/users.json) — indépendant des membres site www.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function usersPath(dataDir) {
  return path.join(dataDir, "users.json");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function readStore(dataDir) {
  const file = usersPath(dataDir);
  if (!fs.existsSync(file)) {
    return { format: "array", users: [], raw: [] };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(raw)) {
    return { format: "array", users: raw, raw };
  }
  if (raw && Array.isArray(raw.users)) {
    return { format: "wrapper", users: raw.users, raw };
  }
  if (raw && typeof raw === "object") {
    const users = Object.entries(raw).map(([email, entry]) => {
      const u = entry && typeof entry === "object" ? { ...entry } : {};
      if (!u.email) u.email = email;
      return u;
    });
    return { format: "map", users, raw };
  }
  return { format: "array", users: [], raw: [] };
}

function writeStore(dataDir, store) {
  const file = usersPath(dataDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let payload;
  if (store.format === "map" && store.raw && !Array.isArray(store.raw)) {
    payload = store.raw;
  } else if (store.format === "wrapper" && store.raw && typeof store.raw === "object") {
    store.raw.users = store.users;
    payload = store.raw;
  } else {
    payload = store.users;
  }
  const tmp = file + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function findUser(store, email) {
  const norm = normalizeEmail(email);
  return store.users.find((u) => normalizeEmail(u.email) === norm);
}

function upsertUser(dataDir, email, fields) {
  const store = readStore(dataDir);
  const norm = normalizeEmail(email);
  let user = findUser(store, norm);
  if (!user) {
    user = { email: norm };
    store.users.push(user);
    if (store.format === "map" && store.raw && typeof store.raw === "object" && !Array.isArray(store.raw)) {
      store.raw[norm] = user;
    }
  }
  Object.assign(user, fields);
  user.email = norm;
  if (store.format === "map" && store.raw && typeof store.raw === "object" && !Array.isArray(store.raw)) {
    store.raw[norm] = user;
  }
  writeStore(dataDir, store);
  return user;
}

async function hashPassword(password) {
  try {
    const bcrypt = require("bcrypt");
    return bcrypt.hash(password, 10);
  } catch {
    const bcryptjs = require("bcryptjs");
    return bcryptjs.hashSync(password, 10);
  }
}

async function verifyPassword(hash, password) {
  if (!hash || !password) return false;

  const libs = [];
  try {
    libs.push(require("bcrypt"));
  } catch {
    /* optional native bcrypt */
  }
  try {
    libs.push(require("bcryptjs"));
  } catch {
    /* optional bcryptjs */
  }

  for (const lib of libs) {
    try {
      if (typeof lib.compare === "function") {
        const ok = await lib.compare(password, hash);
        if (ok) return true;
      } else if (typeof lib.compareSync === "function") {
        if (lib.compareSync(password, hash)) return true;
      }
    } catch {
      /* try next lib */
    }
  }
  return false;
}

function passwordHashFromUser(user) {
  return user.passwordHash || user.password_hash || user.hash || "";
}

function generatePassword(length = 14) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

module.exports = {
  normalizeEmail,
  readStore,
  upsertUser,
  findUser,
  hashPassword,
  verifyPassword,
  passwordHashFromUser,
  generatePassword,
};
