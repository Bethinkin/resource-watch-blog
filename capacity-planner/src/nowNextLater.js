// Now / Next / Later kanban-style board with drag-and-drop between buckets.
window.NowNextLater = (function () {
  function render(state, onChange) {
    const buckets = ['now', 'next', 'later'];
    buckets.forEach((b) => {
      const drop = document.querySelector(`.nnl-drop[data-bucket="${b}"]`);
      if (!drop) return;
      drop.innerHTML = '';
      drop.addEventListener('dragover', onDragOver);
      drop.addEventListener('dragleave', onDragLeave);
      drop.addEventListener('drop', (ev) => onDrop(ev, b, state, onChange));
    });

    (state.initiatives || []).forEach((ini) => {
      const col = document.querySelector(`.nnl-drop[data-bucket="${ini.bucket || 'later'}"]`);
      if (!col) return;
      const card = document.createElement('div');
      card.className = 'nnl-card';
      card.draggable = true;
      card.dataset.id = ini.id;
      card.style.borderLeftColor = ini.color;
      const jira = ini.jiraKey
        ? `<a href="#" data-url="${escapeAttr(ini.jiraUrl || '')}" class="jira-link">${escapeHtml(ini.jiraKey)} ↗</a>`
        : '';
      card.innerHTML = `
        <div class="title">${escapeHtml(ini.name)}</div>
        <div class="meta">
          <span class="size-badge" style="background:${ini.color};color:#fff">${escapeHtml(ini.sizeKey)}</span>
          <span>${escapeHtml(ini.start)} → ${escapeHtml(ini.end)}</span>
          ${jira}
        </div>
      `;
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', ini.id);
        ev.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('.jira-link')) return;
        window.Drawer?.open(state, ini.id, onChange);
      });
      card.addEventListener('dblclick', () => {
        window.Initiatives.openEditModal(state, ini.id, onChange);
      });
      const link = card.querySelector('.jira-link');
      if (link) {
        link.addEventListener('click', (ev) => {
          ev.preventDefault();
          const u = link.getAttribute('data-url');
          if (u && window.api?.openExternal) window.api.openExternal(u);
        });
      }
      col.appendChild(card);
    });
  }

  function onDragOver(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
  }
  function onDragLeave(ev) {
    ev.currentTarget.classList.remove('drag-over');
  }
  function onDrop(ev, bucket, state, onChange) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const id = ev.dataTransfer.getData('text/plain');
    const ini = (state.initiatives || []).find((i) => i.id === id);
    if (!ini) return;
    ini.bucket = bucket;
    onChange();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  return { render };
})();
