// Top-level app: loads state, gates on auth, wires tab switching, and renders
// the active view.
(function () {
  const state = {
    settings: { horizonWeeks: 12, standardWeek: 40 },
    engineers: [],
    sizes: window.TShirt.defaults(),
    initiatives: [],
    jira: { baseUrl: '', email: '', token: '', jql: '', cloudId: '' },
    jiraEpics: []
  };

  let currentView = 'engineers';
  let saveTimer = null;

  function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.Storage.save(state), 250);
  }

  function rerender(persist = true) {
    renderActiveView();
    if (persist) schedulePersist();
  }

  function renderActiveView() {
    document.querySelectorAll('.view').forEach((v) =>
      v.classList.toggle('hidden', v.dataset.view !== currentView)
    );
    document.querySelectorAll('.tab').forEach((t) =>
      t.classList.toggle('active', t.dataset.view === currentView)
    );

    switch (currentView) {
      case 'engineers':
        window.Capacity.renderSummary(state);
        window.Capacity.renderTable(state, rerender);
        break;
      case 'sizing':
        window.TShirt.renderTable(state, rerender);
        break;
      case 'initiatives':
        window.Initiatives.renderList(state, rerender);
        break;
      case 'gantt':
        window.Gantt.render(state, rerender);
        break;
      case 'nnl':
        window.NowNextLater.render(state, rerender);
        break;
      case 'jira':
        window.Jira.renderEpics(state);
        break;
    }
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => {
        currentView = t.dataset.view;
        renderActiveView();
      });
    });
  }

  function renderUserChip() {
    const session = window.Auth.getSession();
    const chip = document.getElementById('user-chip');
    if (!chip) return;
    if (!session) {
      chip.style.display = 'none';
      return;
    }
    chip.style.display = 'flex';
    document.getElementById('user-provider').textContent = session.provider || '';
    document.getElementById('user-name').textContent = session.name || session.email || '';
  }

  function bindHeaderControls() {
    const horizon = document.getElementById('horizon-weeks');
    const std = document.getElementById('standard-week');
    horizon.value = state.settings.horizonWeeks;
    std.value = state.settings.standardWeek;
    horizon.addEventListener('input', () => {
      state.settings.horizonWeeks = Number(horizon.value) || 12;
      rerender();
    });
    std.addEventListener('input', () => {
      state.settings.standardWeek = Number(std.value) || 40;
      rerender();
    });

    document.getElementById('add-engineer').addEventListener('click', () => {
      state.engineers.push({
        name: 'New engineer',
        role: 'Engineer',
        hoursPerWeek: state.settings.standardWeek,
        focusFactor: 0.7,
        ptoWeeks: 0
      });
      rerender();
    });

    document.getElementById('reset-sizes').addEventListener('click', () => {
      state.sizes = window.TShirt.defaults();
      rerender();
    });

    document.getElementById('add-initiative').addEventListener('click', () => {
      state.initiatives = state.initiatives || [];
      const ini = window.Initiatives.newInitiative(state);
      state.initiatives.push(ini);
      rerender();
      window.Initiatives.openEditModal(state, ini.id, rerender);
    });

    const ganttStart = document.getElementById('gantt-start');
    const ganttWeeks = document.getElementById('gantt-weeks');
    ganttStart.addEventListener('input', () => rerender(false));
    ganttWeeks.addEventListener('input', () => rerender(false));

    document.getElementById('jira-fetch').addEventListener('click', () =>
      window.Jira.fetchEpics(state, rerender)
    );

    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('modal').classList.add('hidden');
    });

    const signout = document.getElementById('signout-btn');
    if (signout) signout.addEventListener('click', () => window.Auth.signOut());

    document.addEventListener('cp:state-changed', () => rerender());
    document.addEventListener('cp:auth-changed', () => applyAuthGate());
  }

  async function applyAuthGate() {
    if (!window.Auth) {
      window.Auth = { getSession: () => null, show: () => {}, init: async () => ({}) };
    }
    const session = window.Auth.getSession();
    if (session) {
      window.Auth.show('app');
      renderUserChip();
      await window.Jira.syncAtlassianSites(state);
      renderActiveView();
      schedulePersist();
    } else {
      window.Auth.show('login');
    }
  }

  async function init() {
    const saved = await window.Storage.load();
    if (saved) {
      Object.assign(state.settings, saved.settings || {});
      state.engineers = saved.engineers || [];
      state.sizes = saved.sizes && saved.sizes.length ? saved.sizes : window.TShirt.defaults();
      state.initiatives = saved.initiatives || [];
      state.jira = { ...state.jira, ...(saved.jira || {}) };
      state.jiraEpics = saved.jiraEpics || [];
    }

    bindTabs();
    bindHeaderControls();
    window.Jira.bindSettings(state, rerender);
    if (window.Drawer) window.Drawer.bind();

    const { bypass } = await window.Auth.init();
    if (bypass) {
      window.Auth.show('app');
      renderActiveView();
      return;
    }
    applyAuthGate();
  }

  init();
})();
