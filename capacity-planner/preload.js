const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  fetchJiraEpics: (creds) => ipcRenderer.invoke('jira:fetchEpics', creds)
});
