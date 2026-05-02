// Persists app state via Electron IPC to a JSON file in the user-data dir.
// Falls back to localStorage for browser preview.
window.Storage = (function () {
  const KEY = 'capacity-planner:state';

  async function load() {
    if (window.api && window.api.loadState) {
      const s = await window.api.loadState();
      if (s) return s;
    }
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function save(state) {
    if (window.api && window.api.saveState) {
      await window.api.saveState(state);
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }

  return { load, save };
})();
