// Capacity math and engineers view.
window.Capacity = (function () {
  function effectiveWeeklyHours(eng, standardWeek) {
    const hrs = Number(eng.hoursPerWeek) > 0 ? Number(eng.hoursPerWeek) : standardWeek;
    const focus = Math.max(0, Math.min(1, Number(eng.focusFactor) || 0));
    return hrs * focus;
  }

  function engineerWeeksOverHorizon(eng, horizonWeeks, standardWeek) {
    const available = Math.max(0, horizonWeeks - (Number(eng.ptoWeeks) || 0));
    const eff = effectiveWeeklyHours(eng, standardWeek);
    // Normalize to engineer-weeks at the standard work-week.
    return (available * eff) / standardWeek;
  }

  function teamTotals(state) {
    const horizon = Number(state.settings.horizonWeeks) || 12;
    const standardWeek = Number(state.settings.standardWeek) || 40;
    const rows = (state.engineers || []).map((e) => {
      const eff = effectiveWeeklyHours(e, standardWeek);
      const engWeeks = engineerWeeksOverHorizon(e, horizon, standardWeek);
      return { ...e, effectiveHours: eff, engWeeks };
    });
    const totalEngWeeks = rows.reduce((s, r) => s + r.engWeeks, 0);
    const totalHours = rows.reduce((s, r) => s + r.effectiveHours * horizon, 0);
    const headcount = rows.length;
    return { rows, totalEngWeeks, totalHours, headcount, horizon, standardWeek };
  }

  function renderSummary(state) {
    const el = document.getElementById('capacity-summary');
    if (!el) return;
    const t = teamTotals(state);
    const sized = (state.initiatives || []).reduce((sum, i) => {
      const sizeWeeks = (state.sizes || []).find((s) => s.key === i.sizeKey)?.engWeeks || 0;
      return sum + Number(sizeWeeks);
    }, 0);
    const util = t.totalEngWeeks > 0 ? (sized / t.totalEngWeeks) * 100 : 0;
    el.innerHTML = `
      <div class="cap-card"><div class="label">Engineers</div><div class="value">${t.headcount}</div></div>
      <div class="cap-card"><div class="label">Horizon</div><div class="value">${t.horizon} wks</div></div>
      <div class="cap-card"><div class="label">Capacity</div><div class="value">${t.totalEngWeeks.toFixed(1)} eng-wks</div></div>
      <div class="cap-card"><div class="label">Planned</div><div class="value">${sized.toFixed(1)} eng-wks</div></div>
      <div class="cap-card"><div class="label">Utilization</div><div class="value" style="color:${util > 100 ? 'var(--danger)' : util > 85 ? 'var(--warn)' : 'var(--ok)'}">${util.toFixed(0)}%</div></div>
    `;
  }

  function renderTable(state, onChange) {
    const tbody = document.querySelector('#engineers-table tbody');
    if (!tbody) return;
    const t = teamTotals(state);
    tbody.innerHTML = '';
    t.rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input data-field="name" value="${escapeAttr(r.name || '')}" /></td>
        <td><input data-field="role" value="${escapeAttr(r.role || '')}" /></td>
        <td><input data-field="hoursPerWeek" type="number" min="0" value="${r.hoursPerWeek ?? t.standardWeek}" /></td>
        <td><input data-field="focusFactor" type="number" min="0" max="1" step="0.05" value="${r.focusFactor ?? 0.7}" /></td>
        <td><input data-field="ptoWeeks" type="number" min="0" step="0.5" value="${r.ptoWeeks ?? 0}" /></td>
        <td>${r.effectiveHours.toFixed(1)}</td>
        <td>${r.engWeeks.toFixed(1)}</td>
        <td><button class="danger" data-action="remove">Remove</button></td>
      `;
      tr.querySelectorAll('input[data-field]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const field = inp.getAttribute('data-field');
          state.engineers[idx][field] =
            inp.type === 'number' ? Number(inp.value) : inp.value;
          onChange();
        });
      });
      tr.querySelector('[data-action="remove"]').addEventListener('click', () => {
        state.engineers.splice(idx, 1);
        onChange();
      });
      tbody.appendChild(tr);
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  return { teamTotals, renderSummary, renderTable, engineerWeeksOverHorizon };
})();
