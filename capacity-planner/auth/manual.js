// Local account store: email + PBKDF2-hashed password in a JSON file.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ITERATIONS = 200000;
const KEYLEN = 32;
const DIGEST = 'sha256';

function filePath(userDataDir) {
  return path.join(userDataDir, 'capacity-planner-users.json');
}

function load(userDataDir) {
  try {
    const p = filePath(userDataDir);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

function saveAll(userDataDir, users) {
  fs.writeFileSync(filePath(userDataDir), JSON.stringify(users, null, 2), 'utf8');
}

function hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
}

function signIn(userDataDir, { email, password, name }) {
  if (!email || !password) throw new Error('Email and password are required.');
  const users = load(userDataDir);
  const normalized = email.trim().toLowerCase();
  let user = users.find((u) => u.email === normalized);
  if (!user) {
    // First-time use: auto-create the account.
    const salt = crypto.randomBytes(16).toString('hex');
    user = {
      email: normalized,
      name: name || normalized,
      salt,
      hash: hash(password, salt),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveAll(userDataDir, users);
  } else {
    const attempt = hash(password, user.salt);
    if (attempt !== user.hash) throw new Error('Incorrect password.');
  }
  return {
    provider: 'manual',
    email: user.email,
    name: user.name || user.email
  };
}

module.exports = { signIn };
