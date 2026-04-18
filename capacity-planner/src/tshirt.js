// T-shirt size defaults and rendering.
window.TShirt = (function () {
  const DEFAULTS = [
    { key: 'XS', engWeeks: 1 },
    { key: 'S', engWeeks: 2 },
    { key: 'M', engWeeks: 4 },
    { key: 'L', engWeeks: 8 },
    { key: 'XL', engWeeks: 16 }
  ];

  function defaults() {
    return DEFAULTS.map((d) => ({ ...d }));
  }

  function renderTable(state, onChange) {
    const tbody = document.querySelector('#sizes-table tbody');
    const hint = document.getElementById('team-size-hint');
    if (!tbody) return;
    const headcount = (state.engineers || []).length || 1;
    if (hint) hint.textContent = headcount;

    tbody.innerHTML = '';
    (state.sizes || []).forEach((s, idx) => {
      const tr = document.createElement('tr');
      const calWeeks = headcount > 0 ? (Number(s.engWeeks) / headcount).toFixed(1) : '—';
      tr.innerHTML = `
        <td><input data-field="key" value="${s.key}" style="width:80px" /></td>
        <td><input data-field="engWeeks" type="number" min="0" step="0.5" value="${s.engWeeks}" style="width:100px" /></td>
        <td>${calWeeks}</td>
      `;
      tr.querySelectorAll('input[data-field]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const field = inp.getAttribute('data-field');
          state.sizes[idx][field] =
            inp.type === 'number' ? Number(inp.value) : inp.value;
          onChange();
        });
      });
      tbody.appendChild(tr);
    });
  }

  return { defaults, renderTable };
})();
