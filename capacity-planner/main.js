const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DATA_FILE = () => path.join(app.getPath('userData'), 'capacity-planner-data.json');
const SESSION_FILE = () => path.join(app.getPath('userData'), 'capacity-planner-session.bin');

const authConfig = require('./auth-config');
const oauth = require('./auth/oauth');
const apple = require('./auth/apple');
const manual = require('./auth/manual');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Capacity Planner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.argv.includes('--dev')) win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- App state persistence ----

ipcMain.handle('state:load', async () => {
  try {
    if (!fs.existsSync(DATA_FILE())) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('state:save', async (_evt, state) => {
  fs.writeFileSync(DATA_FILE(), JSON.stringify(state, null, 2), 'utf8');
  return true;
});

ipcMain.handle('external:open', async (_evt, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// ---- Auth session (encrypted with OS keychain when available) ----

function writeSession(session) {
  const json = JSON.stringify(session);
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(SESSION_FILE(), safeStorage.encryptString(json));
  } else {
    fs.writeFileSync(SESSION_FILE(), json, 'utf8');
  }
}

function readSession() {
  try {
    if (!fs.existsSync(SESSION_FILE())) return null;
    const raw = fs.readFileSync(SESSION_FILE());
    const text =
      safeStorage && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE())) fs.unlinkSync(SESSION_FILE());
  } catch {}
}

function publicSession(s) {
  if (!s) return null;
  const { accessToken, refreshToken, idToken, ...rest } = s;
  return { ...rest, hasToken: Boolean(accessToken) };
}

ipcMain.handle('auth:getSession', async () => publicSession(readSession()));

ipcMain.handle('auth:providers', async () => ({
  google: Boolean(authConfig.google.clientId),
  atlassian: Boolean(authConfig.atlassian.clientId && authConfig.atlassian.clientSecret),
  apple: Boolean(
    authConfig.apple.serviceId &&
      authConfig.apple.teamId &&
      authConfig.apple.keyId &&
      authConfig.apple.privateKeyPath
  ),
  manual: true
}));

ipcMain.handle('auth:signin', async (_evt, { provider, credentials }) => {
  let session;
  if (provider === 'google') session = await oauth.signInGoogle(authConfig.google);
  else if (provider === 'atlassian') session = await oauth.signInAtlassian(authConfig.atlassian);
  else if (provider === 'apple') session = await apple.signInApple(authConfig.apple);
  else if (provider === 'manual') session = manual.signIn(app.getPath('userData'), credentials || {});
  else throw new Error('Unknown provider: ' + provider);
  session.signedInAt = Date.now();
  writeSession(session);
  return publicSession(session);
});

ipcMain.handle('auth:signout', async () => {
  clearSession();
  return true;
});

// ---- Jira ----
// Uses the Atlassian OAuth token + cloudid when the user signed in via
// Atlassian; falls back to email + API token otherwise.

function httpRequest({ url, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

ipcMain.handle('jira:fetchEpics', async (_evt, { baseUrl, email, token, jql, cloudId }) => {
  const q = jql && jql.trim() ? jql : 'issuetype = Epic ORDER BY updated DESC';
  const fields = 'summary,status,assignee,issuetype';
  const session = readSession();

  let url;
  let headers = { Accept: 'application/json' };
  let browseBase;

  if (session && session.provider === 'atlassian' && session.accessToken && cloudId) {
    url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${encodeURIComponent(q)}&fields=${fields}&maxResults=100`;
    headers.Authorization = `Bearer ${session.accessToken}`;
    const site = (session.atlassianSites || []).find((s) => s.id === cloudId);
    browseBase = site ? site.url : baseUrl;
  } else {
    if (!baseUrl || !email || !token) throw new Error('Missing Jira credentials.');
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    url = `${normalizedBase}/rest/api/3/search?jql=${encodeURIComponent(q)}&fields=${fields}&maxResults=100`;
    headers.Authorization = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
    browseBase = normalizedBase;
  }

  const res = await httpRequest({ url, headers });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Jira ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.body);
  return (parsed.issues || []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary || i.key,
    status: i.fields?.status?.name || '',
    assignee: i.fields?.assignee?.displayName || '',
    url: `${browseBase.replace(/\/+$/, '')}/browse/${i.key}`
  }));
});

ipcMain.handle('jira:getSites', async () => {
  const session = readSession();
  if (session?.provider === 'atlassian') return session.atlassianSites || [];
  return [];
});
