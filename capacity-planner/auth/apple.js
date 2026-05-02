// Sign in with Apple. Apple uses form_post to POST the id_token to the
// redirect URI, and requires a signed JWT as the client secret.
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const { shell } = require('electron');
const { URL } = require('url');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeClientSecret({ teamId, keyId, serviceId, privateKeyPath }) {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const claims = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 180,
    aud: 'https://appleid.apple.com',
    sub: serviceId
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.createSign('SHA256').update(signingInput).sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(sig)}`;
}

function startLoopback() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

function waitForApplePost(server, expectedState) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Apple sign-in timed out.'));
    }, 5 * 60 * 1000);
    server.on('request', async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      let params = {};
      if (req.method === 'POST') {
        const body = await readBody(req);
        params = Object.fromEntries(new URLSearchParams(body).entries());
      } else {
        params = Object.fromEntries(u.searchParams.entries());
      }
      const ok = !params.error && (!expectedState || params.state === expectedState);
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html' });
      res.end(
        `<!doctype html><html><body style="font-family:-apple-system,sans-serif;padding:40px;background:#0f1117;color:#e6e8ee"><h2>${
          ok ? 'Signed in' : 'Sign-in failed'
        }</h2><p>${ok ? 'You can close this tab.' : params.error || 'State mismatch'}</p></body></html>`
      );
      clearTimeout(timer);
      server.close();
      if (ok) resolve(params);
      else reject(new Error(params.error || 'State mismatch'));
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
        port: 443,
        path: u.pathname,
        headers: { 'Content-Length': Buffer.byteLength(body), ...headers }
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

function decodeIdToken(t) {
  try {
    const parts = t.split('.');
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

async function signInApple(config) {
  if (!config.serviceId || !config.teamId || !config.keyId || !config.privateKeyPath) {
    throw new Error('Apple sign-in is not configured.');
  }
  const { server, port } = await startLoopback();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const state = b64url(crypto.randomBytes(16));
  const params = new URLSearchParams({
    client_id: config.serviceId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state
  });
  shell.openExternal(`https://appleid.apple.com/auth/authorize?${params}`);
  const cb = await waitForApplePost(server, state);

  const clientSecret = makeClientSecret(config);
  const tokenBody = new URLSearchParams({
    client_id: config.serviceId,
    client_secret: clientSecret,
    code: cb.code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  }).toString();
  const tokenRes = await httpsPost('https://appleid.apple.com/auth/token', { 'Content-Type': 'application/x-www-form-urlencoded' }, tokenBody);
  if (tokenRes.status >= 300) throw new Error('Apple token exchange: ' + tokenRes.body.slice(0, 200));
  const tokens = JSON.parse(tokenRes.body);
  const profile = decodeIdToken(tokens.id_token || cb.id_token || '');
  return {
    provider: 'apple',
    email: profile.email || '',
    name: profile.email || 'Apple user',
    accessToken: tokens.access_token || '',
    idToken: tokens.id_token || cb.id_token || '',
    refreshToken: tokens.refresh_token || '',
    expiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000
  };
}

module.exports = { signInApple };
