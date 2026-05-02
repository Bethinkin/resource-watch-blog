// Initiative CRUD, card rendering, and edit modal.
window.Initiatives = (function () {
  const DEFAULT_COLORS = ['#4f8cff', '#37c07b', '#e8a53a', '#e55353', '#a36bff', '#2fb3c6', '#f26f9e', '#6fbf73'];

  function newInitiative(state) {
    const existingColors = (state.initiatives || []).map((i) => i.color);
    const color =
      DEFAULT_COLORS.find((c) => !existingColors.includes(c)) ||
      DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10);
    return {
      id: 'init_' + Math.random().toString(36).slice(2, 10),
      name: 'New initiative',
      description: '',
      tags: [],
      sizeKey: (state.sizes && state.sizes[1] && state.sizes[1].key) || 'S',
      color,
      bucket: 'later',
      start,
      end,
      jiraKey: '',
      jiraUrl: ''
    };
  }

  function normalizeTagsInput(v) {
    return String(v || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function renderList(state, onChange) {
    const el = document.getElementById('initiatives-list');
    if (!el) return;
    el.innerHTML = '';
    (state.initiatives || []).forEach((ini) => {
      const card = document.createElement('div');
      card.className = 'initiative-card';
      card.style.borderLeftColor = ini.color || '#4f8cff';
      const jira = ini.jiraKey
        ? `<a class="jira-link" href="#" data-url="${escapeAttr(ini.jiraUrl || '')}">${escapeAttr(ini.jiraKey)} ↗</a>`
        : '<span class="muted">no epic</span>';
      const tagChips = (ini.tags || [])
        .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
        .join('');
      card.innerHTML = `
        <div class="top">
          <div>
            <div class="name">${escapeHtml(ini.name)}</div>
            <div class="meta">
              <span class="size-badge" style="background:${ini.color};color:#fff">${escapeHtml(ini.sizeKey)}</span>
              <span>${escapeHtml(ini.bucket)}</span>
              <span>${escapeHtml(ini.start)} → ${escapeHtml(ini.end)}</span>
            </div>
          </div>
          <input type="color" value="${ini.color}" data-action="color" />
        </div>
        ${tagChips ? `<div class="tag-row">${tagChips}</div>` : ''}
        <div class="meta">${jira}</div>
        ${ini.description ? `<div class="muted" style="font-size:12px">${escapeHtml(ini.description)}</div>` : ''}
        <div class="row-actions">
          <button data-action="details">Details</button>
          <button data-action="edit">Edit</button>
          <button data-action="remove" class="danger">Delete</button>
        </div>
      `;
      card.querySelector('[data-action="details"]').addEventListener('click', () =>
        window.Drawer?.open(state, ini.id, onChange)
      );
      card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(state, ini.id, onChange));
      card.querySelector('[data-action="remove"]').addEventListener('click', () => {
        if (!confirm(`Delete "${ini.name}"?`)) return;
        state.initiatives = state.initiatives.filter((i) => i.id !== ini.id);
        onChange();
      });
      card.querySelector('[data-action="color"]').addEventListener('input', (ev) => {
        ini.color = ev.target.value;
        onChange();
      });
      const jiraLink = card.querySelector('.jira-link');
      if (jiraLink) {
        jiraLink.addEventListener('click', (ev) => {
          ev.preventDefault();
          const u = jiraLink.getAttribute('data-url');
          if (u && window.api?.openExternal) window.api.openExternal(u);
        });
      }
      el.appendChild(card);
    });
  }

  function openEditModal(state, id, onChange) {
    const ini = state.initiatives.find((i) => i.id === id);
    if (!ini) return;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    title.textContent = 'Edit initiative';
    const sizeOptions = (state.sizes || [])
      .map((s) => `<option value="${s.key}" ${s.key === ini.sizeKey ? 'selected' : ''}>${s.key} (${s.engWeeks} eng-wks)</option>`)
      .join('');
    const bucketOptions = ['now', 'next', 'later']
      .map((b) => `<option value="${b}" ${b === ini.bucket ? 'selected' : ''}>${b}</option>`)
      .join('');
    const epicOptions = (state.jiraEpics || [])
      .map((e) => `<option value="${e.key}|${e.url}">${e.key} — ${e.summary}</option>`)
      .join('');
    const i = window.info || (() => '');
    body.innerHTML = `
      <label>Name<input id="m-name" value="${escapeAttr(ini.name)}" /></label>
      <label>Description ${i('Free-form notes shown on the card and in the details drawer. Markdown is not parsed; line breaks are preserved.')}<textarea id="m-desc" rows="3">${escapeHtml(ini.description || '')}</textarea></label>
      <label>Tags (comma-separated) ${i('Used as filter chips. Example: platform, infra, q3.')}<input id="m-tags" value="${escapeAttr((ini.tags || []).join(', '))}" placeholder="platform, infra, q3" /></label>
      <div class="form-grid">
        <label>Size ${i('T-shirt size in eng-weeks. Defined on the T-shirt Sizes tab.')}<select id="m-size">${sizeOptions}</select></label>
        <label>Bucket ${i('Now = in flight. Next = committed. Later = directional.')}<select id="m-bucket">${bucketOptions}</select></label>
        <label>Start<input type="date" id="m-start" value="${ini.start}" /></label>
        <label>End<input type="date" id="m-end" value="${ini.end}" /></label>
        <label>Color ${i('Used for the Gantt bar and the left edge of the card.')}<input type="color" id="m-color" value="${ini.color}" /></label>
        <label>Jira epic key ${i('Issue key like PROJ-123. Shown on the card and in the drawer.')}<input id="m-jira-key" value="${escapeAttr(ini.jiraKey || '')}" placeholder="PROJ-123" /></label>
      </div>
      <label>Jira URL ${i('Click target for the Jira link in the drawer. Auto-filled if you pick from fetched epics below.')}<input id="m-jira-url" value="${escapeAttr(ini.jiraUrl || '')}" placeholder="https://…/browse/PROJ-123" /></label>
      ${
        epicOptions
          ? `<label>Pick from fetched epics<select id="m-epic-pick"><option value="">—</option>${epicOptions}</select></label>`
          : ''
      }
      <div class="modal-footer">
        <button id="m-cancel">Cancel</button>
        <button id="m-save" class="primary">Save</button>
      </div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('m-cancel').onclick = () => modal.classList.add('hidden');
    const pick = document.getElementById('m-epic-pick');
    if (pick) {
      pick.onchange = () => {
        const [k, u] = pick.value.split('|');
        if (k) document.getElementById('m-jira-key').value = k;
        if (u) document.getElementById('m-jira-url').value = u;
      };
    }
    document.getElementById('m-save').onclick = () => {
      ini.name = document.getElementById('m-name').value.trim() || 'Untitled';
      ini.description = document.getElementById('m-desc').value;
      ini.tags = normalizeTagsInput(document.getElementById('m-tags').value);
      ini.sizeKey = document.getElementById('m-size').value;
      ini.bucket = document.getElementById('m-bucket').value;
      ini.start = document.getElementById('m-start').value;
      ini.end = document.getElementById('m-end').value;
      ini.color = document.getElementById('m-color').value;
      ini.jiraKey = document.getElementById('m-jira-key').value.trim();
      ini.jiraUrl = document.getElementById('m-jira-url').value.trim();
      modal.classList.add('hidden');
      onChange();
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  return { newInitiative, renderList, openEditModal };
})();
