// OAuth helpers: PKCE, loopback callback server, token exchange.
// Handles Google (PKCE) and Atlassian (3LO) out of the box.
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { shell } = require('electron');
const { URL } = require('url');

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function startLoopback() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function waitForCode(server, expectedState) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Sign-in timed out (5 min).'));
    }, 5 * 60 * 1000);

    server.on('request', (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      const params = Object.fromEntries(u.searchParams.entries());
      const ok = !params.error && (!expectedState || params.state === expectedState);
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html' });
      res.end(
        `<!doctype html><html><body style="font-family:-apple-system,sans-serif;padding:40px;background:#0f1117;color:#e6e8ee"><h2>${
          ok ? 'Signed in' : 'Sign-in failed'
        }</h2><p>${
          ok ? 'You can close this tab and return to Capacity Planner.' : params.error_description || params.error || 'State mismatch'
        }</p></body></html>`
      );
      clearTimeout(timer);
      server.close();
      if (ok) resolve(params);
      else reject(new Error(params.error_description || params.error || 'State mismatch'));
    });
  });
}

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          'Content-Length': Buffer.byteLength(body),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: 'GET',
        hostname: u.hostname,
        port: u.port || 443,
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
    req.end();
  });
}

function decodeIdTokenPayload(idToken) {
  try {
    const parts = idToken.split('.');
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

async function signInGoogle(config) {
  if (!config.clientId) throw new Error('Google client ID not configured.');
  const { server, port } = await startLoopback();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const { verifier, challenge } = pkce();
  const state = b64url(crypto.randomBytes(16));
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scope || 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  shell.openExternal(url);
  const cb = await waitForCode(server, state);
  const tokenBody = new URLSearchParams({
    client_id: config.clientId,
    code: cb.code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  }).toString();
  const tokenRes = await httpsPost('https://oauth2.googleapis.com/token', { 'Content-Type': 'application/x-www-form-urlencoded' }, tokenBody);
  if (tokenRes.status >= 300) throw new Error('Google token exchange: ' + tokenRes.body.slice(0, 200));
  const tokens = JSON.parse(tokenRes.body);
  const profile = decodeIdTokenPayload(tokens.id_token || '');
  return {
    provider: 'google',
    email: profile.email || '',
    name: profile.name || profile.email || 'Google user',
    picture: profile.picture || '',
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token || '',
    expiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000
  };
}

async function signInAtlassian(config) {
  if (!config.clientId || !config.clientSecret) throw new Error('Atlassian client ID/secret not configured.');
  const { server, port } = await startLoopback();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const state = b64url(crypto.randomBytes(16));
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.clientId,
    scope: config.scope || 'read:jira-work read:me offline_access',
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent'
  });
  const url = `https://auth.atlassian.com/authorize?${params}`;
  shell.openExternal(url);
  const cb = await waitForCode(server, state);
  const tokenBody = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: cb.code,
    redirect_uri: redirectUri
  });
  const tokenRes = await httpsPost('https://auth.atlassian.com/oauth/token', { 'Content-Type': 'application/json' }, tokenBody);
  if (tokenRes.status >= 300) throw new Error('Atlassian token exchange: ' + tokenRes.body.slice(0, 200));
  const tokens = JSON.parse(tokenRes.body);

  // Fetch user profile and accessible Jira sites.
  const me = await httpsGet('https://api.atlassian.com/me', {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'application/json'
  });
  const profile = me.status < 300 ? JSON.parse(me.body) : {};
  const sitesRes = await httpsGet('https://api.atlassian.com/oauth/token/accessible-resources', {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'application/json'
  });
  const sites = sitesRes.status < 300 ? JSON.parse(sitesRes.body) : [];
  return {
    provider: 'atlassian',
    email: profile.email || '',
    name: profile.name || profile.email || 'Atlassian user',
    picture: profile.picture || '',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    expiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
    atlassianSites: sites.map((s) => ({ id: s.id, name: s.name, url: s.url, scopes: s.scopes }))
  };
}

module.exports = { signInGoogle, signInAtlassian, httpsGet, httpsPost };
