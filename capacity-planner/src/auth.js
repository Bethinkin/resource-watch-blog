// Renderer-side auth controller: manages the login screen, calls into the
// main process for SSO, and exposes the active session to the rest of the app.
window.Auth = (function () {
  let session = null;

  async function init() {
    if (!window.api?.getSession) {
      // No Electron APIs (e.g., opened in a plain browser); skip auth gate.
      return { session: null, bypass: true };
    }
    session = await window.api.getSession();
    const providers = await window.api.getAuthProviders();
    renderAvailability(providers);
    bindLogin(providers);
    return { session, bypass: false };
  }

  function renderAvailability(providers) {
    document.querySelectorAll('.sso[data-provider]').forEach((btn) => {
      const p = btn.dataset.provider;
      if (!providers[p]) {
        btn.disabled = true;
        btn.title = `${p} SSO not configured in auth-config.js`;
      }
    });
    const avail = document.getElementById('sso-availability');
    if (avail) {
      const disabled = ['google', 'atlassian', 'apple'].filter((p) => !providers[p]);
      avail.textContent = disabled.length
        ? `Not configured: ${disabled.join(', ')}. Add client IDs in auth-config.js to enable.`
        : '';
    }
  }

  function bindLogin(providers) {
    document.querySelectorAll('.sso[data-provider]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider;
        if (!providers[provider]) return;
        await attempt(provider);
      });
    });
    const form = document.getElementById('manual-form');
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await attempt('manual', {
          email: document.getElementById('manual-email').value,
          password: document.getElementById('manual-password').value,
          name: document.getElementById('manual-name').value
        });
      });
    }
  }

  async function attempt(provider, credentials) {
    const err = document.getElementById('login-error');
    err.textContent = '';
    try {
      const s = await window.api.signIn(provider, credentials);
      session = s;
      document.dispatchEvent(new CustomEvent('cp:auth-changed'));
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  }

  async function signOut() {
    if (!window.api?.signOut) return;
    await window.api.signOut();
    session = null;
    document.dispatchEvent(new CustomEvent('cp:auth-changed'));
  }

  function getSession() {
    return session;
  }

  function show(which) {
    document.getElementById('login-screen').classList.toggle('hidden', which !== 'login');
    document.getElementById('app-header').classList.toggle('hidden', which !== 'app');
    document.getElementById('views').classList.toggle('hidden', which !== 'app');
  }

  return { init, signOut, getSession, show };
})();
