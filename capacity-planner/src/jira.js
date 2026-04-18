// Jira settings + epic browser.
//
// Two modes:
//   1. Atlassian SSO: token is already in the main process; the user picks
//      a Jira cloud site (cloudid) from the accessible-resources list.
//   2. Manual: base URL + email + API token (stored in state).
window.Jira = (function () {
  function bindSettings(state, onChange) {
    const fields = {
      'jira-base': 'baseUrl',
      'jira-email': 'email',
      'jira-token': 'token',
      'jira-jql': 'jql'
    };
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = state.jira?.[key] || '';
      el.addEventListener('input', () => {
        state.jira = state.jira || {};
        state.jira[key] = el.value;
        onChange(false);
      });
    });
  }

  async function syncAtlassianSites(state) {
    if (!window.api?.getJiraSites) return;
    const sites = await window.api.getJiraSites();
    state.atlassianSites = sites;
    if (sites.length && !state.jira.cloudId) {
      state.jira.cloudId = sites[0].id;
    }
    renderSiteContext(state);
  }

  function renderSiteContext(state) {
    const host = document.getElementById('jira-status');
    if (!host) return;
    const sites = state.atlassianSites || [];
    if (!sites.length) return;
    const options = sites
      .map((s) => `<option value="${s.id}" ${s.id === state.jira.cloudId ? 'selected' : ''}>${s.name} (${s.url})</option>`)
      .join('');
    host.innerHTML = `
      <label>Atlassian site
        <select id="jira-site">${options}</select>
      </label>
      <span class="muted tiny">Signed in via Atlassian SSO — API token below is ignored when a site is selected.</span>
    `;
    const sel = document.getElementById('jira-site');
    if (sel) {
      sel.addEventListener('change', () => {
        state.jira.cloudId = sel.value;
      });
    }
  }

  async function fetchEpics(state, onChange) {
    const status = document.getElementById('jira-status');
    if (!window.api?.fetchJiraEpics) {
      status.textContent = 'Jira fetch is only available in the desktop app.';
      return;
    }
    const hasAtlassianSso = (state.atlassianSites || []).length > 0;
    const hasManual = state.jira?.baseUrl && state.jira?.email && state.jira?.token;
    if (!hasAtlassianSso && !hasManual) {
      status.textContent = 'Sign in with Atlassian or fill in base URL, email, and API token first.';
      return;
    }
    const note = status.querySelector('.muted, .tiny');
    status.insertAdjacentHTML('beforeend', ' · Fetching…');
    try {
      const epics = await window.api.fetchJiraEpics({
        baseUrl: state.jira.baseUrl,
        email: state.jira.email,
        token: state.jira.token,
        jql: state.jira.jql,
        cloudId: state.jira.cloudId
      });
      state.jiraEpics = epics;
      renderSiteContext(state);
      status.insertAdjacentText('beforeend', ` Fetched ${epics.length} epic(s).`);
      renderEpics(state);
      onChange();
    } catch (err) {
      renderSiteContext(state);
      const e = document.createElement('span');
      e.style.color = 'var(--danger)';
      e.textContent = ' Error: ' + err.message;
      status.appendChild(e);
    }
  }

  function renderEpics(state) {
    const host = document.getElementById('jira-epics');
    if (!host) return;
    host.innerHTML = '';
    (state.jiraEpics || []).forEach((e) => {
      const card = document.createElement('div');
      card.className = 'jira-epic';
      card.innerHTML = `
        <div class="key">${escapeHtml(e.key)}</div>
        <div class="summary">${escapeHtml(e.summary)}</div>
        <div class="meta">
          <span>${escapeHtml(e.status || '')}</span>
          <span>${escapeHtml(e.assignee || '')}</span>
        </div>
        <div class="row-actions" style="margin-top:8px;display:flex;gap:6px">
          <button data-action="open">Open in Jira</button>
          <button data-action="convert" class="primary">Add as initiative</button>
        </div>
      `;
      card.querySelector('[data-action="open"]').addEventListener('click', () => {
        if (e.url && window.api?.openExternal) window.api.openExternal(e.url);
      });
      card.querySelector('[data-action="convert"]').addEventListener('click', () => {
        const ini = window.Initiatives.newInitiative(state);
        ini.name = e.summary;
        ini.jiraKey = e.key;
        ini.jiraUrl = e.url;
        state.initiatives = state.initiatives || [];
        state.initiatives.push(ini);
        document.dispatchEvent(new CustomEvent('cp:state-changed'));
      });
      host.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { bindSettings, fetchEpics, renderEpics, syncAtlassianSites };
})();
