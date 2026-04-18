const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DATA_FILE = path.join(app.getPath('userData'), 'capacity-planner-data.json');

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

ipcMain.handle('state:load', async () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
});

ipcMain.handle('state:save', async (_evt, state) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  return true;
});

ipcMain.handle('external:open', async (_evt, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

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
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

ipcMain.handle('jira:fetchEpics', async (_evt, { baseUrl, email, token, jql }) => {
  if (!baseUrl || !email || !token) throw new Error('Missing Jira credentials');
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const q = jql && jql.trim() ? jql : 'issuetype = Epic ORDER BY updated DESC';
  const url = `${normalizedBase}/rest/api/3/search?jql=${encodeURIComponent(q)}&fields=summary,status,assignee,issuetype&maxResults=100`;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const res = await httpRequest({
    url,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    }
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Jira ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.body);
  return (parsed.issues || []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary || i.key,
    status: i.fields?.status?.name || '',
    assignee: i.fields?.assignee?.displayName || '',
    url: `${normalizedBase}/browse/${i.key}`
  }));
});
