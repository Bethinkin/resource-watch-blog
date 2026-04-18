// Jira settings + epic browser. Credentials and fetched epics persist with the rest of state.
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

  async function fetchEpics(state, onChange) {
    const status = document.getElementById('jira-status');
    if (!state.jira?.baseUrl || !state.jira?.email || !state.jira?.token) {
      status.textContent = 'Fill in base URL, email, and API token first.';
      return;
    }
    if (!window.api?.fetchJiraEpics) {
      status.textContent = 'Jira fetch is only available in the desktop app.';
      return;
    }
    status.textContent = 'Fetching…';
    try {
      const epics = await window.api.fetchJiraEpics({
        baseUrl: state.jira.baseUrl,
        email: state.jira.email,
        token: state.jira.token,
        jql: state.jira.jql
      });
      state.jiraEpics = epics;
      status.textContent = `Fetched ${epics.length} epic(s).`;
      renderEpics(state);
      onChange();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
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

  return { bindSettings, fetchEpics, renderEpics };
})();
