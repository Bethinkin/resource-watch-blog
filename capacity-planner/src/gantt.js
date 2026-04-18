// Gantt chart rendering: initiatives as colored bars across a weekly timeline.
window.Gantt = (function () {
  const MS_PER_DAY = 864e5;

  function startOfWeek(d) {
    const x = new Date(d);
    const day = x.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // Monday start
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function formatWeek(d) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function render(state, onChange) {
    const host = document.getElementById('gantt');
    if (!host) return;
    const startInput = document.getElementById('gantt-start');
    const weeksInput = document.getElementById('gantt-weeks');
    if (!startInput.value) {
      startInput.value = startOfWeek(new Date()).toISOString().slice(0, 10);
    }
    const start = startOfWeek(new Date(startInput.value));
    const weeks = Math.max(4, Math.min(52, Number(weeksInput.value) || 16));

    const weekDates = [];
    for (let i = 0; i < weeks; i++) {
      weekDates.push(new Date(start.getTime() + i * 7 * MS_PER_DAY));
    }

    const cols = `repeat(${weeks}, minmax(60px, 1fr))`;
    host.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'gantt-header';
    header.innerHTML = `
      <div class="gantt-label"><strong>Initiative</strong></div>
      <div class="gantt-cells" style="grid-template-columns:${cols}">
        ${weekDates.map((d) => `<div class="gantt-cell">W${formatWeek(d)}</div>`).join('')}
      </div>
    `;
    host.appendChild(header);

    const inis = state.initiatives || [];
    if (!inis.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.style.padding = '20px';
      empty.textContent = 'No initiatives yet. Add some on the Initiatives tab.';
      host.appendChild(empty);
      return;
    }

    const rangeStart = start.getTime();
    const rangeEnd = rangeStart + weeks * 7 * MS_PER_DAY;

    inis.forEach((ini) => {
      const row = document.createElement('div');
      row.className = 'gantt-row';

      const label = document.createElement('div');
      label.className = 'gantt-label';
      label.innerHTML = `
        <span class="swatch" style="background:${ini.color}"></span>
        <div>
          <div>${escapeHtml(ini.name)}</div>
          <div class="muted" style="font-size:11px">${escapeHtml(ini.sizeKey)} · ${escapeHtml(ini.bucket)}${ini.jiraKey ? ' · ' + escapeHtml(ini.jiraKey) : ''}</div>
        </div>
      `;

      const cells = document.createElement('div');
      cells.className = 'gantt-cells';
      cells.style.gridTemplateColumns = cols;
      for (let i = 0; i < weeks; i++) {
        const c = document.createElement('div');
        c.className = 'gantt-cell';
        cells.appendChild(c);
      }

      const iniStart = new Date(ini.start).getTime();
      const iniEnd = new Date(ini.end).getTime();
      if (!isNaN(iniStart) && !isNaN(iniEnd) && iniEnd >= rangeStart && iniStart <= rangeEnd) {
        const clampedStart = Math.max(iniStart, rangeStart);
        const clampedEnd = Math.min(iniEnd, rangeEnd);
        const totalDays = weeks * 7;
        const leftDays = (clampedStart - rangeStart) / MS_PER_DAY;
        const spanDays = Math.max(1, (clampedEnd - clampedStart) / MS_PER_DAY);
        const leftPct = (leftDays / totalDays) * 100;
        const widthPct = (spanDays / totalDays) * 100;
        const bar = document.createElement('div');
        bar.className = 'gantt-bar';
        bar.style.background = ini.color;
        bar.style.left = leftPct + '%';
        bar.style.width = widthPct + '%';
        bar.textContent = `${ini.name} · ${ini.sizeKey}`;
        bar.title = `${ini.name}\n${ini.start} → ${ini.end}\n${ini.sizeKey} · ${ini.bucket}${ini.jiraKey ? '\n' + ini.jiraKey : ''}`;
        bar.addEventListener('click', () => {
          if (window.Drawer) window.Drawer.open(state, ini.id, onChange);
        });
        cells.appendChild(bar);
      }

      row.appendChild(label);
      row.appendChild(cells);
      host.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render };
})();
