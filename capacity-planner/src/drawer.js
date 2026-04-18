// Right-side detail drawer. Opened by clicking a Gantt bar, NNL card,
// or the "Details" button on an initiative card.
window.Drawer = (function () {
  let currentId = null;
  let currentState = null;
  let currentOnChange = null;

  function root() {
    return document.getElementById('drawer');
  }

  function open(state, id, onChange) {
    currentState = state;
    currentId = id;
    currentOnChange = onChange;
    render();
    root().classList.add('visible');
    root().setAttribute('aria-hidden', 'false');
  }

  function close() {
    root().classList.remove('visible');
    root().setAttribute('aria-hidden', 'true');
    currentId = null;
  }

  function render() {
    const ini = (currentState?.initiatives || []).find((i) => i.id === currentId);
    const body = document.getElementById('drawer-body');
    if (!ini || !body) return;

    const sizeDef = (currentState.sizes || []).find((s) => s.key === ini.sizeKey);
    const engWeeks = sizeDef ? sizeDef.engWeeks : '—';
    const tagChips = (ini.tags || [])
      .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
      .join('');
    const jiraBlock = ini.jiraKey
      ? `<a href="#" id="drawer-jira" class="jira-link" data-url="${escapeAttr(ini.jiraUrl || '')}">${escapeHtml(ini.jiraKey)} ↗</a>`
      : '<span class="muted">No linked epic</span>';

    body.innerHTML = `
      <div class="drawer-swatch" style="background:${ini.color}"></div>
      <h2 class="drawer-title">${escapeHtml(ini.name)}</h2>
      <div class="drawer-meta">
        <span class="size-badge" style="background:${ini.color};color:#fff">${escapeHtml(ini.sizeKey)}</span>
        <span class="muted">${escapeHtml(ini.bucket)}</span>
        <span class="muted">${engWeeks} eng-wks</span>
      </div>
      ${tagChips ? `<div class="tag-row">${tagChips}</div>` : ''}
      <section class="drawer-section">
        <h4>Timeline</h4>
        <div>${escapeHtml(ini.start || '—')} → ${escapeHtml(ini.end || '—')}</div>
      </section>
      <section class="drawer-section">
        <h4>Description</h4>
        <div class="drawer-desc">${ini.description ? escapeHtml(ini.description).replace(/\n/g, '<br>') : '<span class="muted">No description.</span>'}</div>
      </section>
      <section class="drawer-section">
        <h4>Jira</h4>
        <div>${jiraBlock}</div>
      </section>
      <div class="drawer-actions">
        <button id="drawer-edit" class="primary">Edit</button>
        <button id="drawer-close">Close</button>
      </div>
    `;

    const jiraLink = document.getElementById('drawer-jira');
    if (jiraLink) {
      jiraLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        const u = jiraLink.getAttribute('data-url');
        if (u && window.api?.openExternal) window.api.openExternal(u);
      });
    }
    document.getElementById('drawer-edit').addEventListener('click', () => {
      const openId = currentId;
      close();
      window.Initiatives.openEditModal(currentState, openId, () => {
        if (currentOnChange) currentOnChange();
      });
    });
    document.getElementById('drawer-close').addEventListener('click', close);
  }

  function bind() {
    const backdrop = document.getElementById('drawer-backdrop');
    const closeBtn = document.getElementById('drawer-close-x');
    if (backdrop) backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') close();
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  return { open, close, bind };
})();
